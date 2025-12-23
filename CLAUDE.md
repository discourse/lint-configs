# ESLint Rule Development

When asked to create/fix an ESLint rule for the Discourse lint-configs project.

Project Structure

- Rule files: ./lint-configs/eslint-rules/
- Test files: ./lint-configs/test/eslint-rules/
- Utilities: ./lint-configs/eslint-rules/utils/

Available Utilities

- fixImport() from ./utils/fix-import.mjs - Helps add/remove named imports and remove default imports (cannot rename default imports)
- Check other exported functions in utilities folder for more details about them

Testing Commands

- Run all tests (from root directory): `cd lint-configs && pnpm test`
 
- Important: 
  * Do NOT run test files directly with node
  * The test command must be run from the lint-configs directory using pnpm 
  * The test script (from lint-configs/package.json) runs: `cd ../test && node test.js`

Key Development Patterns

1. Prefer AST Over Regex

- Always use the Abstract Syntax Tree (AST) for code analysis instead of regular expressions
- AST analysis is more reliable and understands code structure, not just patterns
- Avoids false positives (won't match strings/comments that look like code)
- Handles edge cases better (syntax variations, whitespace, formatting)
- More maintainable and less brittle when code formatting changes
- Use node visitors and ESLint context to access the full AST

2. Rule Structure

- Use context.getSourceCode() to get AST
- Common handlers: ImportDeclaration, MethodDefinition, Property, CallExpression, Decorator
- Track state with variables at the top of create()
- Use analyzeAllImports() pattern to avoid race conditions

3. When to Report Errors

- Report on the most specific node (e.g., defaultSpecifier not entire ImportDeclaration)
- Provide fix function for auto-fixable issues
- Return undefined for fix when manual intervention needed
- Don't provide auto-fixes that could introduce runtime errors or change behavior
  - Example: spreading with optional chaining (`...this.items?.map()`) is unsafe
  - Example: adding fallbacks like `|| []` changes the intended behavior
  - Better to report the error and let developers fix it manually with proper context
- Provide helpful error messages that explain why auto-fix isn't possible
  - Include the specific problem (e.g., "parameter 'title' is reassigned")
  - Show concrete examples of how to fix it manually
  - Reference the actual code elements (parameter names, property paths)
  - Example: "Cannot auto-fix @discourseComputed because parameter 'groups' is used in a spread operator. Example: Use '...(this.model.groups || [])' or '...(this.model.groups ?? [])' for safe spreading."

4. Import Handling

- Check for naming conflicts across all imports
- Handle aliases (e.g., import { computed as emberComputed })
- Track both original and local names for renamed imports
- Use fixImport() utility when possible, manually construct when needed

5. Test Structure

{                                                                                                                               
name: "descriptive test name",                                                                                                
code: ["line 1", "line 2"].join("\n"),                                                                                        
errors: [                                                                                                                     
{ message: "error message 1" },                                                                                             
{ message: "error message 2" }                                                                                              
],                                                                                                                            
output: ["expected line 1", "expected line 2"].join("\n")                                                                     
}

6. Common Pitfalls to Avoid

- Don't report same error multiple times (check if handlers overlap)
- Remember to handle both CallExpression and plain Identifier for decorators
- Test with renamed/aliased imports
- Handle mixed scenarios (some fixable, some not)
- Test import order variations
- Avoid optional chaining in unsafe contexts (spread operators, arithmetic operations, etc.)
  - Example: `...this.items?.map()` is unsafe - if items is undefined, spreading undefined throws
  - Check parent node type (SpreadElement, BinaryExpression) before adding optional chaining

Task Description

Rule Name: [e.g., discourse-computed]

Goal: [What should this rule enforce/transform?]

Examples:                                                                                                                       
// Before (invalid code)                                                                                                        
[example]

// After (expected output)                                                                                                      
[example]

Special Requirements:
- [Any edge cases or specific behaviors needed]

Files to modify:
- Rule: lint-configs/eslint-rules/[rule-name].mjs
- Tests: test/eslint-rules/[rule-name].test.mjs