import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNanoGPTModels, type NanoGPTModel } from '$lib/backend/models/nano-gpt';
import { getEnabledModels } from '$lib/db/queries/user-enabled-models';
import { getAuthenticatedUserId } from '$lib/backend/auth-utils';

// GET - get all models with capabilities and enabled status
export const GET: RequestHandler = async ({ request }) => {
	const userId = await getAuthenticatedUserId(request);

	// Get all available models from NanoGPT API
	const nanoGPTModelsResult = await getNanoGPTModels();
	const nanoGPTModels = nanoGPTModelsResult.unwrapOr([] as NanoGPTModel[]);

	// Get user's enabled models from database
	const enabledModelsMap = await getEnabledModels(userId);

	// Merge the data: add enabled/pinned info to each model
	const models = nanoGPTModels.map((model) => {
		const key = `nanogpt:${model.id}`;
		const enabledModel = enabledModelsMap[key];

		return {
			...model,
			enabled: !!enabledModel,
			pinned: enabledModel?.pinned ?? false,
		};
	});

	return json(models);
};
