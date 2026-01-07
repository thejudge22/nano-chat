<script lang="ts">
	import { useCachedQuery, api } from '$lib/cache/cached-query.svelte';
	import Tooltip from '$lib/components/ui/tooltip.svelte';
	import { IsMobile } from '$lib/hooks/is-mobile.svelte';
	import { models as modelsState } from '$lib/state/models.svelte';
	import { session } from '$lib/state/session.svelte';
	import { settings } from '$lib/state/settings.svelte';
	import { Provider } from '$lib/types';
	import { fuzzysearch } from '$lib/utils/fuzzy-search';
	import {
		supportsImages,
		supportsReasoning,
		supportsVideo,
		isImageOnlyModel,
		supportsVision,
	} from '$lib/utils/model-capabilities';
	import { capitalize } from '$lib/utils/strings';
	import { cn } from '$lib/utils/utils';
	import BrainIcon from '~icons/lucide/brain';
	import SearchIcon from '~icons/lucide/search';
	import EyeIcon from '~icons/lucide/eye';
	import VideoIcon from '~icons/lucide/video';
	import StarIcon from '~icons/lucide/star';
	import InfoIcon from '~icons/lucide/info';
	import FilterIcon from '~icons/lucide/filter';
	import ImageIcon from '~icons/lucide/image';
	import { Command } from 'bits-ui';
	import * as Popover from '$lib/components/ui/popover';
	import { shortcut, getKeybindOptions } from '$lib/actions/shortcut.svelte';
	import { Button } from '../ui/button';
	import { Kbd } from '../ui/kbd';
	import { cmdOrCtrl, formatKeybind } from '$lib/hooks/is-mac.svelte';
	import { keybinds, DEFAULT_KEYBINDS } from '$lib/state/keybinds.svelte';
	import { mutate } from '$lib/client/mutation.svelte';
	import { ResultAsync } from 'neverthrow';
	import PinIcon from '~icons/lucide/pin';
	import { isFirefox } from '$lib/hooks/is-firefox.svelte';
	import ModelInfoPanel from './model-info-panel.svelte';
	import type { NanoGPTModel } from '$lib/backend/models/nano-gpt';

	// Helper to check if model is pinned
	function isPinned(model: { pinned?: boolean }): boolean {
		return model.pinned === true;
	}

	type Props = {
		class?: string;
		/* When images are attached, we should not select models that don't support images */
		onlyImageModels?: boolean;
	};

	let { class: className, onlyImageModels }: Props = $props();

	const enabledModelsQuery = useCachedQuery(api.user_enabled_models.get_enabled, {});

	const enabledArr = $derived(Object.values(enabledModelsQuery.data ?? {}));

	modelsState.init();

	let search = $state('');
	let selectedProvider = $state<string | null>(null);
	let infoModel = $state<NanoGPTModel | null>(null);

	// Get unique providers from enabled models using icon_url or fallback
	const uniqueProviders = $derived.by(() => {
		const providers = new Map<string, { iconUrl: string; count: number }>();

		for (const model of enabledArr) {
			const nanoModel = modelsState.from(Provider.NanoGPT).find((m) => m.id === model.modelId);
			// Use icon_url from API, or check for fallback icon
			let iconUrl = nanoModel?.icon_url;
			if (!iconUrl) {
				// Check for fallback icon based on model ID
				const lowerModelId = model.modelId.toLowerCase();
				if (lowerModelId.includes('grok') || lowerModelId.includes('x-ai')) {
					iconUrl = 'fallback:grok';
				}
			}
			if (iconUrl) {
				const existing = providers.get(iconUrl);
				providers.set(iconUrl, {
					iconUrl: iconUrl,
					count: (existing?.count ?? 0) + 1,
				});
			}
		}

		return Array.from(providers.values());
	});

	const filteredModels = $derived(
		fuzzysearch({
			haystack: enabledArr,
			needle: search,
			property: 'modelId',
		})
			.filter((model) => {
				// When searching, show all providers
				if (search) return true;
				if (!selectedProvider) return true;
				const nanoModel = modelsState.from(Provider.NanoGPT).find((m) => m.id === model.modelId);
				// Check icon_url first, then check for fallback match
				if (nanoModel?.icon_url === selectedProvider) return true;
				// Check for fallback provider match
				if (selectedProvider === 'fallback:grok') {
					const lowerModelId = model.modelId.toLowerCase();
					if (lowerModelId.includes('grok') || lowerModelId.includes('x-ai')) return true;
				}
				return false;
			})
			.sort((a, b) => {
				const aPinned = isPinned(a);
				const bPinned = isPinned(b);
				if (aPinned && !bPinned) return -1;
				if (!aPinned && bPinned) return 1;
				return 0;
			})
	);

	const currentModel = $derived(enabledArr.find((m) => m.modelId === settings.modelId));

	$effect(() => {
		if (enabledModelsQuery.isLoading) return;
		if (!enabledArr.find((m) => m.modelId === settings.modelId) && enabledArr.length > 0) {
			settings.modelId = enabledArr[0]!.modelId;
		}
	});

	let open = $state(false);

	let activeModel = $state('');

	// Auto-select first model when picker opens
	$effect(() => {
		if (open && filteredModels.length > 0 && !activeModel) {
			activeModel = filteredModels[0]?.modelId ?? '';
		}
	});

	// Model name formatting utility
	const termReplacements = [
		{ from: 'gpt', to: 'GPT' },
		{ from: 'claude', to: 'Claude' },
		{ from: 'deepseek', to: 'DeepSeek' },
		{ from: 'o3', to: 'o3' },
	];

	function formatModelName(modelId: string | undefined) {
		if (!modelId) return { full: 'Unknown Model', primary: 'Unknown', secondary: '' };
		const cleanId = modelId.replace(/^[^/]+\//, '');
		const parts = cleanId.split(/[-_,:]/);

		const formattedParts = parts.map((part) => {
			let formatted = capitalize(part);
			termReplacements.forEach(({ from, to }) => {
				formatted = formatted.replace(new RegExp(`\\b${from}\\b`, 'gi'), to);
			});
			return formatted;
		});

		return {
			full: formattedParts.join(' '),
			primary: formattedParts[0] || '',
			secondary: formattedParts.slice(1).join(' '),
		};
	}

	function modelSelected(modelId: string) {
		settings.modelId = modelId;
		open = false;
	}

	let pinning = $state(false);

	async function togglePin(modelId: string, e?: MouseEvent) {
		e?.stopPropagation();
		e?.preventDefault();
		pinning = true;

		await ResultAsync.fromPromise(
			mutate(
				api.user_enabled_models.toggle_pinned.url,
				{
					action: 'togglePinned',
					modelId,
				},
				{
					invalidatePatterns: [api.user_enabled_models.get_enabled.url],
				}
			),
			(e) => e
		);

		pinning = false;
	}

	const isMobile = new IsMobile();

	const activeModelInfo = $derived.by(() => {
		if (activeModel === '') return null;

		const model = enabledArr.find((m) => m.modelId === activeModel);

		if (!model) return null;

		return {
			...model,
			formatted: formatModelName(activeModel),
		};
	});

	const pinnedModels = $derived(enabledArr.filter((m) => isPinned(m)));

	// Fallback icons for providers that don't have icon_url in the API
	const FALLBACK_ICONS: Record<string, string> = {
		grok: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Grok-icon.svg/640px-Grok-icon.svg.png',
		'x-ai':
			'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Grok-icon.svg/640px-Grok-icon.svg.png',
	};

	function getIconUrl(iconPath: string | undefined, modelId?: string): string {
		if (iconPath) {
			// Handle fallback: protocol for sidebar icons
			if (iconPath.startsWith('fallback:')) {
				const fallbackKey = iconPath.replace('fallback:', '');
				return FALLBACK_ICONS[fallbackKey] ?? '';
			}
			// Icons are served from nano-gpt.com
			if (iconPath.startsWith('/')) {
				return `https://nano-gpt.com${iconPath}`;
			}
			return iconPath;
		}

		// Check for fallback based on model ID
		if (modelId) {
			const lowerModelId = modelId.toLowerCase();
			for (const [key, url] of Object.entries(FALLBACK_ICONS)) {
				if (lowerModelId.includes(key)) {
					return url;
				}
			}
		}

		return '';
	}
</script>

<svelte:window use:shortcut={getKeybindOptions('openModelPicker', () => (open = true))} />

<Popover.Root bind:open>
	<Popover.Trigger
		class={cn(
			'ring-offset-background focus:ring-ring flex items-center justify-between rounded-lg px-2 py-1 text-xs transition hover:text-white focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
			className
		)}
	>
		<div class="flex items-center gap-2 pr-2">
			<span class="truncate">
				{#if enabledArr.length === 0}
					Loading...
				{:else if currentModel}
					{formatModelName(currentModel.modelId).full}
				{:else}
					Select model
				{/if}
			</span>
		</div>
	</Popover.Trigger>

	<Popover.Content
		portalProps={{
			disabled: isFirefox,
		}}
		side="bottom"
		align="start"
		sideOffset={4}
		collisionPadding={20}
		hideWhenDetached={true}
		onOpenAutoFocus={(e) => e.preventDefault()}
		class={cn(
			'overflow-hidden p-0 transition-all duration-200',
			infoModel ? 'w-[840px]' : 'w-[520px]',
			'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
			{
				'max-w-[calc(100vw-2rem)]': isMobile.current,
			}
		)}
	>
		{#if enabledArr.length === 0}
			<div class="text-muted-foreground flex items-center justify-center p-8">
				<p>Loading models...</p>
			</div>
		{:else}
			<div class="flex w-full overflow-hidden">
				<!-- Provider Sidebar -->
				<div class="border-border bg-muted/30 flex flex-col gap-1 border-r p-2">
					<!-- Favorites/All button -->
					<button
						class={cn(
							'hover:bg-accent flex items-center justify-center rounded-lg p-2 transition-colors',
							selectedProvider === null && 'bg-accent text-accent-foreground'
						)}
						onclick={() => {
							search = '';
							selectedProvider = null;
						}}
					>
						<StarIcon class="size-5" />
					</button>

					<!-- Provider icons -->
					{#each uniqueProviders as provider (provider.iconUrl)}
						<button
							class={cn(
								'hover:bg-accent flex items-center justify-center rounded-lg p-2 transition-colors',
								selectedProvider === provider.iconUrl && 'bg-accent text-accent-foreground'
							)}
							onclick={() => {
								search = '';
								selectedProvider = provider.iconUrl;
							}}
						>
							<img
								src={getIconUrl(provider.iconUrl)}
								alt="Provider"
								class="size-5 object-contain"
							/>
						</button>
					{/each}
				</div>

				<!-- Main content -->
				<div class="min-w-0 flex-1 overflow-hidden">
					<Command.Root
						class={cn('flex h-full w-full flex-col overflow-hidden')}
						bind:value={activeModel}
						shouldFilter={false}
					>
						<label
							class="border-border relative flex items-center gap-2 border-b px-4 py-3 text-sm"
						>
							<SearchIcon class="text-muted-foreground size-4" />
							<Command.Input
								class="placeholder:text-muted-foreground w-full bg-transparent outline-none"
								placeholder="Search models..."
								bind:value={search}
								onkeydown={(e) => {
									// Arrow key navigation
									if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
										e.preventDefault();
										const currentIndex = filteredModels.findIndex((m) => m.modelId === activeModel);
										let newIndex: number;

										if (e.key === 'ArrowDown') {
											newIndex = currentIndex < filteredModels.length - 1 ? currentIndex + 1 : 0;
										} else {
											newIndex = currentIndex > 0 ? currentIndex - 1 : filteredModels.length - 1;
										}

										const newModel = filteredModels[newIndex];
										if (newModel) {
											activeModel = newModel.modelId;
										}
										return;
									}

									// Enter to select
									if (e.key === 'Enter' && activeModel) {
										e.preventDefault();
										modelSelected(activeModel);
										return;
									}

									// Get pin config with fallback to defaults
									const pinConfig = keybinds.pinModel ?? DEFAULT_KEYBINDS.pinModel;

									// Check modifiers - compare as booleans
									const hasCtrlOrMeta = e.ctrlKey || e.metaKey;
									const ctrlRequired = pinConfig.ctrl === true;
									const shiftRequired = pinConfig.shift === true;
									const altRequired = pinConfig.alt === true;

									const ctrlMatch = ctrlRequired === hasCtrlOrMeta;
									const shiftMatch = shiftRequired === e.shiftKey;
									const altMatch = altRequired === e.altKey;
									const keyMatch = e.key.toLowerCase() === String(pinConfig.key).toLowerCase();

									if (ctrlMatch && shiftMatch && altMatch && keyMatch && activeModelInfo) {
										e.preventDefault();
										e.stopPropagation();
										togglePin(activeModelInfo.id);
									}
								}}
							/>
							<FilterIcon class="text-muted-foreground size-4 opacity-50" />
						</label>
						<Command.List
							class="flex flex-col gap-0.5 overflow-y-auto p-1"
							style="max-height: 400px;"
						>
							{#each filteredModels as model (model.id)}
								{@const formatted = formatModelName(model.modelId)}
								{@const nanoGPTModel = modelsState
									.from(Provider.NanoGPT)
									.find((m) => m.id === model.modelId)}
								{@const modelIconUrl = getIconUrl(nanoGPTModel?.icon_url, model.modelId)}
								{@const disabled = false}

								<Command.Item
									value={model.modelId}
									class={cn(
										'flex gap-3 overflow-hidden rounded-lg p-2',
										'relative cursor-pointer scroll-m-36 select-none',
										'hover:bg-accent/50',
										'data-selected:bg-accent/50 data-selected:text-accent-foreground',
										disabled && 'opacity-50',
										activeModel === model.modelId && 'bg-accent/50 text-accent-foreground'
									)}
									onSelect={() => modelSelected(model.modelId)}
									onmouseenter={() => (activeModel = model.modelId)}
								>
									<!-- Provider Icon -->
									<div class="flex flex-shrink-0 items-start pt-0.5">
										{#if modelIconUrl}
											<img src={modelIconUrl} alt="" class="size-5 object-contain" />
										{:else}
											<div
												class="bg-muted text-muted-foreground flex size-5 items-center justify-center rounded text-xs"
											>
												?
											</div>
										{/if}
									</div>

									<!-- Model Info -->
									<div class="min-w-0 flex-1 overflow-hidden">
										<div class="flex items-center gap-2">
											<span class="truncate text-sm font-semibold">
												{formatted.full}
											</span>

											<!-- Favorite star toggle -->
											<button
												class={cn(
													'flex-shrink-0 rounded p-0.5 transition-colors',
													isPinned(model)
														? 'text-yellow-400'
														: 'text-muted-foreground/50 hover:text-yellow-400'
												)}
												onclick={(e) => togglePin(model.id, e)}
											>
												<StarIcon class={cn('size-3.5', isPinned(model) && 'fill-current')} />
											</button>
										</div>

										<!-- Description -->
										{#if nanoGPTModel?.description}
											<p class="text-muted-foreground mt-0.5 max-w-full truncate text-xs">
												{nanoGPTModel.description}
											</p>
										{/if}
									</div>

									<!-- Capability badges -->
									<div class="flex flex-shrink-0 items-center gap-1.5">
										{#if nanoGPTModel && supportsVision(nanoGPTModel)}
											<Tooltip>
												{#snippet trigger(tooltip)}
													<div
														{...tooltip.trigger}
														class="rounded-md bg-purple-500/20 p-1.5 text-purple-400"
													>
														<EyeIcon class="size-3.5" />
													</div>
												{/snippet}
												Supports vision
											</Tooltip>
										{/if}

										{#if nanoGPTModel && supportsReasoning(nanoGPTModel)}
											<Tooltip>
												{#snippet trigger(tooltip)}
													<div
														{...tooltip.trigger}
														class="rounded-md bg-green-500/20 p-1.5 text-green-400"
													>
														<BrainIcon class="size-3.5" />
													</div>
												{/snippet}
												Supports reasoning
											</Tooltip>
										{/if}

										{#if nanoGPTModel && isImageOnlyModel(nanoGPTModel)}
											<Tooltip>
												{#snippet trigger(tooltip)}
													<div
														{...tooltip.trigger}
														class="rounded-md bg-blue-500/20 p-1.5 text-blue-400"
													>
														<ImageIcon class="size-3.5" />
													</div>
												{/snippet}
												Image generation
											</Tooltip>
										{/if}

										{#if nanoGPTModel && supportsVideo(nanoGPTModel)}
											<Tooltip>
												{#snippet trigger(tooltip)}
													<div
														{...tooltip.trigger}
														class="rounded-md bg-cyan-500/20 p-1.5 text-cyan-400"
													>
														<VideoIcon class="size-3.5" />
													</div>
												{/snippet}
												Supports video generation
											</Tooltip>
										{/if}

										<!-- Info button -->
										<Tooltip>
											{#snippet trigger(tooltip)}
												<button
													{...tooltip.trigger}
													class="text-muted-foreground/50 hover:text-muted-foreground rounded-full p-1 transition-colors"
													onclick={(e) => {
														e.stopPropagation();
														if (nanoGPTModel) {
															infoModel = infoModel?.id === nanoGPTModel.id ? null : nanoGPTModel;
														}
													}}
												>
													<InfoIcon class="size-4" />
												</button>
											{/snippet}
											Model info
										</Tooltip>
									</div>
								</Command.Item>
							{/each}
						</Command.List>
					</Command.Root>
				</div>

				<!-- Info Panel -->
				{#if infoModel}
					<ModelInfoPanel
						model={infoModel}
						iconUrl={getIconUrl(infoModel.icon_url, infoModel.id)}
						onClose={() => (infoModel = null)}
					/>
				{/if}
			</div>

			<!-- Footer with pin shortcut -->
			{#if !isMobile.current && activeModelInfo}
				<div class="border-border flex place-items-center justify-between border-t p-2">
					<div>
						<Button
							variant="ghost"
							loading={pinning}
							class="bg-popover"
							size="sm"
							onclick={() => togglePin(activeModelInfo.id)}
						>
							<span class="text-muted-foreground">
								{isPinned(activeModelInfo) ? 'Unpin' : 'Pin'}
							</span>
							<span>
								{#each formatKeybind(keybinds.pinModel) as key}
									<Kbd size="xs">{key}</Kbd>
								{/each}
							</span>
						</Button>
					</div>
				</div>
			{/if}
		{/if}
	</Popover.Content>
</Popover.Root>
