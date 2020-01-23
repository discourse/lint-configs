/**
 * @fileoverview Keep Ember.Object out of the codebase
 * @author Mark VanLandingham
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

var rule = require("../../../lib/rules/ember-object"),

    RuleTester = require("eslint").RuleTester;


//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

var ruleTester = new RuleTester();
ruleTester.run("ember-object", rule, {

    valid: [

        // give me some code that won't trigger a warning
    ],

    invalid: [
        {
            code: "Ember.Object",
            errors: [{
                message: "Fill me in.",
                type: "Me too"
            }]
        }
    ]
});
