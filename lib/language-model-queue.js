let languageModelChain = Promise.resolve();

export function runLanguageModelTask(task) {
  const next = languageModelChain.then(task);
  languageModelChain = next.catch(() => {});
  return next;
}
