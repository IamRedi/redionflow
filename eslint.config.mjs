import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const visibleTextAttributes = new Set(["placeholder", "title", "alt"]);

function hasHumanText(value) {
  return /[\p{L}\p{N}]/u.test(value);
}

const i18nGuardPlugin = {
  rules: {
    "no-hardcoded-jsx-text": {
      meta: {
        type: "suggestion",
        docs: {
          description: "Warn when visible JSX text is hardcoded instead of using t(...).",
        },
        messages: {
          hardcodedText: "Visible JSX text should use t(\"...\") instead of a hardcoded string.",
          hardcodedAttribute: "Visible JSX attribute text should use t(\"...\") instead of a hardcoded string.",
        },
        schema: [],
      },
      create(context) {
        return {
          JSXText(node) {
            const text = node.value.replace(/\s+/g, " ").trim();
            if (!text || !hasHumanText(text)) return;

            context.report({
              node,
              messageId: "hardcodedText",
            });
          },
          JSXExpressionContainer(node) {
            const expression = node.expression;

            if (
              expression?.type === "Literal" &&
              typeof expression.value === "string" &&
              hasHumanText(expression.value)
            ) {
              context.report({
                node,
                messageId: "hardcodedText",
              });
            }

            if (
              expression?.type === "TemplateLiteral" &&
              expression.expressions.length === 0 &&
              hasHumanText(expression.quasis.map((quasi) => quasi.value.cooked ?? "").join(""))
            ) {
              context.report({
                node,
                messageId: "hardcodedText",
              });
            }
          },
          JSXAttribute(node) {
            if (node.name.type !== "JSXIdentifier") return;
            const attributeName = node.name.name;
            if (!visibleTextAttributes.has(attributeName)) return;

            if (
              node.value?.type === "Literal" &&
              typeof node.value.value === "string" &&
              hasHumanText(node.value.value)
            ) {
              context.report({
                node,
                messageId: "hardcodedAttribute",
              });
            }

            if (
              node.value?.type === "JSXExpressionContainer" &&
              node.value.expression?.type === "Literal" &&
              typeof node.value.expression.value === "string" &&
              hasHumanText(node.value.expression.value)
            ) {
              context.report({
                node,
                messageId: "hardcodedAttribute",
              });
            }

            if (
              node.value?.type === "JSXExpressionContainer" &&
              node.value.expression?.type === "TemplateLiteral" &&
              node.value.expression.expressions.length === 0 &&
              hasHumanText(node.value.expression.quasis.map((quasi) => quasi.value.cooked ?? "").join(""))
            ) {
              context.report({
                node,
                messageId: "hardcodedAttribute",
              });
            }
          },
        };
      },
    },
  },
};

const eslintConfig = [
  {
    ignores: ["src/generated/prisma/**", "src/app/demo/**", "src/components/demo/**"],
  },
  ...nextCoreWebVitals,
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      i18n: i18nGuardPlugin,
    },
    rules: {
      "i18n/no-hardcoded-jsx-text": "warn",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];

export default eslintConfig;

