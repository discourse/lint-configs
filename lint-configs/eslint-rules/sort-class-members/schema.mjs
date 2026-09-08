/**
 * @fileoverview Options schema for the `sort-class-members` rule. Mirrors the
 * upstream `eslint-plugin-sort-class-members` schema so existing configuration
 * keeps validating.
 */

const orderSchema = {
  type: "array",
  items: {
    anyOf: [
      { type: "string" },
      {
        type: "object",
        properties: {
          name: { type: "string" },
          groupByDecorator: {
            oneOf: [{ type: "string" }, { type: "boolean" }],
          },
          type: { enum: ["method", "property"] },
          kind: { enum: ["get", "set", "accessor", "nonAccessor"] },
          propertyType: { type: "string" },
          accessorPair: { type: "boolean" },
          sort: { enum: ["alphabetical", "none"] },
          static: { type: "boolean" },
          private: { type: "boolean" },
          async: { type: "boolean" },
          accessibility: { enum: ["public", "private", "protected"] },
          abstract: { type: "boolean" },
          override: { type: "boolean" },
          readonly: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
};

export const sortClassMembersSchema = [
  {
    type: "object",
    properties: {
      order: orderSchema,
      groups: {
        type: "object",
        patternProperties: {
          "^.+$": orderSchema,
        },
        additionalProperties: false,
      },
      stopAfterFirstProblem: { type: "boolean" },
      sortInterfaces: { type: "boolean" },
      accessorPairPositioning: {
        enum: ["getThenSet", "setThenGet", "together", "any"],
      },
      locale: { type: "string" },
    },
    additionalProperties: false,
  },
];
