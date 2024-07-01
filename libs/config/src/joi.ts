import Joi from 'joi';

interface When {
  ref: string;
  options: Joi.WhenOptions;
}

/**
 * Add a when condition to the rules
 * @param rules - The rules to add the when condition to
 * @param keys - The keys to add the when condition to
 * @param when - The when condition
 */
export function addWhen(
  rules: Record<string, Joi.Schema>,
  keys: string[],
  when: When,
): void {
  if (!keys) {
    keys = Object.keys(rules);
  }

  for (const key of keys) {
    if (!rules.hasOwnProperty(key)) {
      throw new Error(`Key ${key} not found in rules`);
    }

    const rule = rules[key];
    rules[key] = rule.when(when.ref, when.options);
  }
}

export function addWhenToAll(
  rules: Record<string, Joi.Schema>,
  when: When,
): void {
  addWhen(rules, Object.keys(rules), when);
}

export function addWhenOnRequiredRules(
  rules: Record<string, Joi.Schema>,
  when: When,
) {
  const required = getRequiredRules(rules);
  addWhen(rules, required, when);
}

export function getRequiredRules(rules: Record<string, Joi.Schema>): string[] {
  const required: string[] = [];

  for (const key in rules) {
    const rule = rules[key];
    const flags = rule.describe().flags as { presence: string } | undefined;
    if (flags?.presence === 'required') {
      required.push(key);
    }
  }

  return required;
}
