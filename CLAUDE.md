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