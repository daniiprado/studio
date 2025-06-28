'use server';
/**
 * @fileOverview An AI flow for handling chat with an NPC.
 *
 * - npcChat - A function that handles conversation with the NPC.
 * - NpcChatInput - The input type for the npcChat function.
 * - NpcChatOutput - The return type for the npcChat function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const NpcChatInputSchema = z.object({
  message: z.string().optional().describe('A text message from the player.'),
  audioDataUri: z.string().optional().describe(
      "An audio recording from the player, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type NpcChatInput = z.infer<typeof NpcChatInputSchema>;

const NpcChatOutputSchema = z.object({
  response: z.string().describe("The NPC's response to the player."),
});
export type NpcChatOutput = z.infer<typeof NpcChatOutputSchema>;

export async function npcChat(input: NpcChatInput): Promise<NpcChatOutput> {
  return npcChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'npcChatPrompt',
  input: {schema: NpcChatInputSchema},
  output: {schema: NpcChatOutputSchema},
  prompt: `You are a friendly and slightly mysterious Quest Giver in a fantasy world called ServiAdventures. Your name is Ana. Respond to the player's message in a concise and engaging way. Offer them a simple quest if they seem interested.

If the input is audio, it will be automatically transcribed for you.

Player's message: {{{message}}}{{media url=audioDataUri}}`,
});

const npcChatFlow = ai.defineFlow(
  {
    name: 'npcChatFlow',
    inputSchema: NpcChatInputSchema,
    outputSchema: NpcChatOutputSchema,
  },
  async input => {
    if (!input.message && !input.audioDataUri) {
      return { response: "You approached me but didn't say anything." };
    }
    
    const {output} = await prompt(input);
    return output!;
  }
);
