import { db, generateId } from '../index';
import { messageInteractions, type MessageInteraction } from '../schema';
import { eq, and, desc } from 'drizzle-orm';

export async function logMessageInteraction(data: {
    messageId: string;
    userId: string;
    action: 'regenerate' | 'edit' | 'copy' | 'share';
    metadata?: Record<string, unknown>;
}): Promise<MessageInteraction> {
    const [result] = await db
        .insert(messageInteractions)
        .values({
            id: generateId(),
            messageId: data.messageId,
            userId: data.userId,
            action: data.action,
            metadata: data.metadata,
            createdAt: new Date(),
        })
        .returning();

    return result!;
}

export async function getMessageInteractionsByMessage(
    messageId: string
): Promise<MessageInteraction[]> {
    const results = await db.query.messageInteractions.findMany({
        where: eq(messageInteractions.messageId, messageId),
        orderBy: [desc(messageInteractions.createdAt)],
    });
    return results;
}

export async function getMessageInteractionsByUser(
    userId: string,
    limit?: number
): Promise<MessageInteraction[]> {
    const results = await db.query.messageInteractions.findMany({
        where: eq(messageInteractions.userId, userId),
        orderBy: [desc(messageInteractions.createdAt)],
        limit: limit,
    });
    return results;
}

export async function getMessageInteractionsByUserAndAction(
    userId: string,
    action: 'regenerate' | 'edit' | 'copy' | 'share'
): Promise<MessageInteraction[]> {
    const results = await db.query.messageInteractions.findMany({
        where: and(eq(messageInteractions.userId, userId), eq(messageInteractions.action, action)),
        orderBy: [desc(messageInteractions.createdAt)],
    });
    return results;
}

export async function deleteMessageInteraction(interactionId: string): Promise<void> {
    await db.delete(messageInteractions).where(eq(messageInteractions.id, interactionId));
}
