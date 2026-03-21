export default {
  title: 'Form Requests',
  content: `
<h2>Introduction</h2>
<p>Form Requests are dedicated classes for handling validation and authorization of incoming requests. Instead of writing validation logic inside your controller methods, you can extract it into a <code>FormRequest</code> subclass. This keeps controllers clean and makes validation rules reusable and testable.</p>

<h2>Creating Form Requests</h2>
<p>Generate a new form request using the CLI:</p>

<pre><code class="language-bash">bun mantiq make:request StoreUserRequest
</code></pre>

<p>This creates a file in <code>app/Requests/</code>:</p>

<pre><code class="language-typescript">import { FormRequest } from '@mantiq/validation'

export class StoreUserRequest extends FormRequest {
  /**
   * Determine if the user is authorized to make this request.
   */
  override authorize(): boolean {
    return true
  }

  /**
   * Get the validation rules that apply to the request.
   */
  override rules(): Record&lt;string, string&gt; {
    return {
      name: 'required|string|max:255',
      email: 'required|email|unique:users,email',
      password: 'required|string|min:8|confirmed',
    }
  }
}
</code></pre>

<h2>The rules() Method</h2>
<p>The <code>rules()</code> method returns an object where keys are field names and values are pipe-delimited validation rule strings. These follow the same syntax as the <code>Validator</code> class:</p>

<pre><code class="language-typescript">override rules(): Record&lt;string, string&gt; {
  return {
    title: 'required|string|max:200',
    body: 'required|string',
    category_id: 'required|integer|exists:categories,id',
    tags: 'nullable|string',
    published: 'boolean',
  }
}
</code></pre>

<p>You can use dynamic logic inside <code>rules()</code>. Since the method has access to the current request, you can vary rules based on the HTTP method, route parameters, or the authenticated user:</p>

<pre><code class="language-typescript">override rules(): Record&lt;string, string&gt; {
  const userId = this.request.param('id')

  return {
    name: 'required|string|max:255',
    // On update, exclude the current user from the unique check
    email: userId
      ? \`required|email|unique:users,email,\${userId}\`
      : 'required|email|unique:users,email',
    password: userId
      ? 'nullable|string|min:8|confirmed'    // optional on update
      : 'required|string|min:8|confirmed',   // required on create
  }
}
</code></pre>

<h2>The authorize() Method</h2>
<p>The <code>authorize()</code> method determines whether the current user has permission to make this request. Return <code>true</code> to allow the request, or <code>false</code> to reject it with a 403 Forbidden response:</p>

<pre><code class="language-typescript">override authorize(): boolean {
  // Only allow the owner to update their own post
  const post = this.request.param('post')
  const user = this.request.user()

  return user !== null &amp;&amp; post.get('user_id') === user.getAuthIdentifier()
}
</code></pre>

<p>If you do not need authorization logic, simply return <code>true</code>:</p>

<pre><code class="language-typescript">override authorize(): boolean {
  return true
}
</code></pre>

<p>Authorization is checked before validation runs. If <code>authorize()</code> returns false, the validation rules are never executed.</p>

<h2>Using Form Requests in Controllers</h2>
<p>Create a form request instance with the incoming request and call <code>validate()</code>. If authorization fails or validation fails, an error is thrown:</p>

<pre><code class="language-typescript">import { StoreUserRequest } from '../Requests/StoreUserRequest.ts'

class UserController {
  async store(request: MantiqRequest) {
    const form = new StoreUserRequest(request)
    const data = await form.validate()

    const user = await User.create(data)
    return MantiqResponse.json(user.toObject(), 201)
  }

  async update(request: MantiqRequest) {
    const user = await User.findOrFail(request.param('id'))
    const form = new UpdateUserRequest(request)
    const data = await form.validate()

    user.fill(data)
    await user.save()

    return MantiqResponse.json(user.toObject())
  }
}
</code></pre>

<p>If validation fails, a <code>ValidationError</code> is thrown. If <code>authorize()</code> returns false, an <code>UnauthorizedError</code> is thrown.</p>

<h2>Custom Error Messages</h2>
<p>Override the <code>messages()</code> method to provide custom error messages for specific field-rule combinations:</p>

<pre><code class="language-typescript">export class StoreUserRequest extends FormRequest {
  override rules(): Record&lt;string, string&gt; {
    return {
      name: 'required|string|max:255',
      email: 'required|email',
      password: 'required|min:8|confirmed',
    }
  }

  override messages(): Record&lt;string, string&gt; {
    return {
      'name.required': 'We need to know your name.',
      'email.required': 'An email address is required.',
      'email.email': 'Please provide a valid email address.',
      'password.required': 'A password is required.',
      'password.min': 'Your password must be at least :min characters.',
      'password.confirmed': 'The password confirmation does not match.',
    }
  }
}
</code></pre>

<h2>Custom Attribute Names</h2>
<p>Override the <code>attributes()</code> method to provide human-friendly names for fields. These names are used in the auto-generated error messages:</p>

<pre><code class="language-typescript">override attributes(): Record&lt;string, string&gt; {
  return {
    email: 'email address',
    dob: 'date of birth',
    phone_number: 'phone number',
  }
}
// "The email address field is required." instead of "The email field is required."
</code></pre>

<h2>Accessing Validated Data</h2>
<p>After calling <code>validate()</code>, only the fields defined in your rules are returned with their validated values. This prevents any extra fields from sneaking through:</p>

<pre><code class="language-typescript">const validated = request.validate()
// Only contains keys defined in rules(): { name, email, password }
// Even if the request body included additional fields like is_admin
</code></pre>

<h2>Complete Example</h2>
<p>Here is a full example showing a form request for creating a blog post:</p>

<pre><code class="language-typescript">// app/Requests/StorePostRequest.ts
import { FormRequest } from '@mantiq/validation'

export class StorePostRequest extends FormRequest {
  override authorize(): boolean {
    // Only authenticated users can create posts
    return this.request.user() !== null
  }

  override rules(): Record&lt;string, string&gt; {
    return {
      title: 'required|string|min:5|max:200',
      body: 'required|string|min:50',
      category_id: 'required|integer|exists:categories,id',
      tags: 'nullable|string|max:500',
      published: 'boolean',
    }
  }

  override messages(): Record&lt;string, string&gt; {
    return {
      'title.min': 'Post titles must be at least :min characters.',
      'body.min': 'Please write at least :min characters for the post body.',
    }
  }

  override attributes(): Record&lt;string, string&gt; {
    return {
      category_id: 'category',
    }
  }
}

// app/Controllers/PostController.ts
class PostController {
  async store(request: MantiqRequest) {
    const form = new StorePostRequest(request)
    const data = await form.validate()

    const post = await Post.create({
      ...data,
      user_id: request.user().getAuthIdentifier(),
    })

    return MantiqResponse.json(post.toObject(), 201)
  }
}
</code></pre>
`
}
