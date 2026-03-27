export default {
  title: 'Validation',
  content: `
<h2>Introduction</h2>
<p>MantiqJS provides a powerful validation system for ensuring that incoming data meets your application's requirements. The <code>Validator</code> class from <code>@mantiq/validation</code> supports 46 built-in rules with a concise pipe-delimited syntax, custom error messages, and the ability to define your own rules.</p>

<h2>Basic Usage</h2>
<p>Create a <code>Validator</code> instance with the data to validate and a set of rules, then call <code>validate()</code>:</p>

<pre><code class="language-typescript">import { Validator } from '@mantiq/validation'

const data = {
  name: 'Alice',
  email: 'alice@example.com',
  age: 25,
}

const rules = {
  name: 'required|string|max:255',
  email: 'required|email|max:100',
  age: 'required|integer|min:18',
}

const validator = new Validator(data, rules)
const validated = await validator.validate()
// =&gt; { name: 'Alice', email: 'alice@example.com', age: 25 }
</code></pre>

<p>If validation fails, a <code>ValidationError</code> is thrown with a 422 status code and a structured <code>errors</code> object:</p>

<pre><code class="language-typescript">try {
  const validated = await validator.validate()
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.errors)
    // {
    //   email: ['The email field must be a valid email address.'],
    //   age: ['The age field must be at least 18.'],
    // }
  }
}
</code></pre>

<h2>Rule Syntax</h2>
<p>Rules are defined as pipe-delimited strings. Each rule can have parameters separated by colons:</p>

<pre><code class="language-typescript">const rules = {
  username: 'required|string|min:3|max:20',
  email: 'required|email|unique:users,email',
  password: 'required|string|min:8|confirmed',
  role: 'required|in:admin,editor,viewer',
  age: 'nullable|integer|between:18,120',
}
</code></pre>

<h2>Available Rules</h2>
<p>MantiqJS ships with 46 built-in validation rules:</p>

<h3>Presence Rules</h3>
<table>
  <thead><tr><th>Rule</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>required</code></td><td>The field must be present and not empty</td></tr>
    <tr><td><code>required_if:field,value</code></td><td>Required when another field equals a value</td></tr>
    <tr><td><code>required_unless:field,value</code></td><td>Required unless another field equals a value</td></tr>
    <tr><td><code>required_with:field1,field2</code></td><td>Required when any of the listed fields are present</td></tr>
    <tr><td><code>required_without:field1,field2</code></td><td>Required when any of the listed fields are absent</td></tr>
    <tr><td><code>nullable</code></td><td>The field may be <code>null</code>; subsequent rules are skipped if null</td></tr>
    <tr><td><code>sometimes</code></td><td>Only validate when the field is present</td></tr>
    <tr><td><code>filled</code></td><td>If present, must not be empty</td></tr>
  </tbody>
</table>

<h3>Type Rules</h3>
<table>
  <thead><tr><th>Rule</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>string</code></td><td>Must be a string</td></tr>
    <tr><td><code>numeric</code></td><td>Must be numeric (integer or float)</td></tr>
    <tr><td><code>integer</code></td><td>Must be an integer</td></tr>
    <tr><td><code>boolean</code></td><td>Must be a boolean (or truthy/falsy values like 1, 0, "true", "false")</td></tr>
    <tr><td><code>array</code></td><td>Must be an array</td></tr>
    <tr><td><code>date</code></td><td>Must be a valid date string</td></tr>
    <tr><td><code>json</code></td><td>Must be a valid JSON string</td></tr>
  </tbody>
</table>

<h3>Format Rules</h3>
<table>
  <thead><tr><th>Rule</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>email</code></td><td>Must be a valid email address</td></tr>
    <tr><td><code>url</code></td><td>Must be a valid URL</td></tr>
    <tr><td><code>uuid</code></td><td>Must be a valid UUID</td></tr>
    <tr><td><code>ip</code></td><td>Must be a valid IP address (v4 or v6)</td></tr>
    <tr><td><code>alpha</code></td><td>Must contain only alphabetic characters</td></tr>
    <tr><td><code>alpha_num</code></td><td>Must contain only alphanumeric characters</td></tr>
    <tr><td><code>alpha_dash</code></td><td>Must contain only alphanumeric characters, dashes, and underscores</td></tr>
    <tr><td><code>regex:pattern</code></td><td>Must match the given regular expression</td></tr>
    <tr><td><code>not_regex:pattern</code></td><td>Must not match the given regular expression</td></tr>
    <tr><td><code>starts_with:value1,value2</code></td><td>Must start with one of the given values</td></tr>
    <tr><td><code>ends_with:value1,value2</code></td><td>Must end with one of the given values</td></tr>
  </tbody>
</table>

<h3>Size Rules</h3>
<table>
  <thead><tr><th>Rule</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>min:value</code></td><td>Minimum value (number) or length (string/array)</td></tr>
    <tr><td><code>max:value</code></td><td>Maximum value (number) or length (string/array)</td></tr>
    <tr><td><code>between:min,max</code></td><td>Value or length must be between min and max (inclusive)</td></tr>
    <tr><td><code>size:value</code></td><td>Must be exactly this length (string/array) or value (number)</td></tr>
    <tr><td><code>digits:value</code></td><td>Must be a numeric string with exactly this many digits</td></tr>
    <tr><td><code>digits_between:min,max</code></td><td>Must be a numeric string with digits between min and max</td></tr>
  </tbody>
</table>

<h3>Comparison Rules</h3>
<table>
  <thead><tr><th>Rule</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>in:val1,val2,...</code></td><td>Must be one of the listed values</td></tr>
    <tr><td><code>not_in:val1,val2,...</code></td><td>Must not be one of the listed values</td></tr>
    <tr><td><code>confirmed</code></td><td>A matching <code>&lt;field&gt;_confirmation</code> field must exist</td></tr>
    <tr><td><code>same:other</code></td><td>Must match the value of another field</td></tr>
    <tr><td><code>different:other</code></td><td>Must differ from the value of another field</td></tr>
    <tr><td><code>gt:field</code></td><td>Must be greater than the value of another field</td></tr>
    <tr><td><code>gte:field</code></td><td>Must be greater than or equal to the value of another field</td></tr>
    <tr><td><code>lt:field</code></td><td>Must be less than the value of another field</td></tr>
    <tr><td><code>lte:field</code></td><td>Must be less than or equal to the value of another field</td></tr>
  </tbody>
</table>

<h3>Date Rules</h3>
<table>
  <thead><tr><th>Rule</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>before:date</code></td><td>Must be a date before the given date</td></tr>
    <tr><td><code>after:date</code></td><td>Must be a date after the given date</td></tr>
    <tr><td><code>before_or_equal:date</code></td><td>Must be a date on or before the given date</td></tr>
    <tr><td><code>after_or_equal:date</code></td><td>Must be a date on or after the given date</td></tr>
  </tbody>
</table>

<h3>Database Rules</h3>
<table>
  <thead><tr><th>Rule</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>unique:table,column</code></td><td>Value must not already exist in the specified table and column</td></tr>
    <tr><td><code>exists:table,column</code></td><td>Value must exist in the specified table and column</td></tr>
  </tbody>
</table>

<h2>Custom Error Messages</h2>
<p>Override the default error messages by passing a third argument to the Validator constructor:</p>

<pre><code class="language-typescript">const validator = new Validator(data, rules, {
  'name.required': 'Please enter your name.',
  'email.email': 'That does not look like a valid email address.',
  'age.min': 'You must be at least :min years old.',
})
</code></pre>

<p>Message keys follow the format <code>field.rule</code>. You can use the <code>:attribute</code>, <code>:min</code>, <code>:max</code>, and <code>:value</code> placeholders that will be automatically replaced.</p>

<h2>Custom Attribute Names</h2>
<p>By default, field names are used as-is in error messages. You can provide human-friendly names:</p>

<pre><code class="language-typescript">const validator = new Validator(data, rules, {}, {
  email: 'email address',
  dob: 'date of birth',
})

// Error: "The email address field is required." instead of "The email field is required."
</code></pre>

<h2>Extending with Custom Rules</h2>
<p>Register custom validation rules by extending the Validator:</p>

<pre><code class="language-typescript">import { Validator } from '@mantiq/validation'

Validator.extend('phone', (value, params, field) =&gt; {
  const pattern = /^\+?[\\d\\s\\-()]{7,15}$/
  if (!pattern.test(String(value))) {
    return \`The \${field} field must be a valid phone number.\`
  }
  return true
})

// Usage
const rules = {
  mobile: 'required|phone',
}
</code></pre>

<p>A custom rule function receives the value, any parameters (from <code>rule:param1,param2</code>), and the field name. Return <code>true</code> if valid, or an error message string if invalid.</p>

<h2>Validating in Controllers</h2>
<p>You can validate request data directly inside a controller method:</p>

<pre><code class="language-typescript">import { Validator } from '@mantiq/validation'

class UserController {
  async store(request: MantiqRequest) {
    const data = await request.input()

    const validator = new Validator(data, {
      name: 'required|string|max:255',
      email: 'required|email|unique:users,email',
      password: 'required|string|min:8|confirmed',
    })

    const validated = await validator.validate()
    // If we reach here, validation passed

    const user = await User.create(validated)
    return MantiqResponse.json(user.toObject(), 201)
  }
}
</code></pre>

<p>For cleaner controllers, consider using <a href="/docs/form-requests">Form Requests</a> to extract validation logic into dedicated classes.</p>

<h2>The ValidationError</h2>
<p>When validation fails, a <code>ValidationError</code> is thrown. This is an <code>HttpError</code> with a 422 status code. The framework's exception handler automatically renders it as a JSON response for API requests:</p>

<pre><code class="language-typescript">// Automatic JSON response for API routes:
{
  "message": "The given data was invalid.",
  "errors": {
    "email": [
      "The email field must be a valid email address."
    ],
    "password": [
      "The password field must be at least 8 characters."
    ]
  }
}
</code></pre>
`
}
