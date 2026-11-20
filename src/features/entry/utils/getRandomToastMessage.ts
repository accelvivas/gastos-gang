import {
  gastosToastMessages,
  genericToastMessages,
  type DefaultToastCategory,
} from '@/features/entry/copy/gastosToastMessages';

function isDefaultCategory(value: string): value is DefaultToastCategory {
  return Object.prototype.hasOwnProperty.call(gastosToastMessages, value);
}

export function getRandomToastMessage(
  categoryName: string,
  previousMessage?: string
): string {
  const normalizedCategory = categoryName.trim().toLowerCase();
  const messages = isDefaultCategory(normalizedCategory)
    ? gastosToastMessages[normalizedCategory]
    : genericToastMessages;
  const candidates =
    messages.length > 1 && previousMessage
      ? messages.filter((message) => message !== previousMessage)
      : [...messages];
  const safeCandidates = candidates.length > 0 ? candidates : [...messages];
  const index = Math.floor(Math.random() * safeCandidates.length);

  return safeCandidates[index] ?? safeCandidates[0] ?? genericToastMessages[0];
}
