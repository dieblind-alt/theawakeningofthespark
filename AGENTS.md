# Agent Instructions

## API Key & Secret Management
To prevent runtime crashes and ensure environment variables are automatically mapped correctly in this environment:
- **ALWAYS use Lazy Initialization for SDKs:** Do not initialize SDKs (like Stripe, Lulu, etc.) at the top level of a module. Initialize them dynamically inside a getter function or route handler just in time when first requested.
- **Fail Fast with Clear Errors:** If an API key is missing when the initialization function is called, throw a clear, descriptive, and localized error immediately.
- **Never Globally Load Variables:** Always access `process.env` within the scope of the request or the lazy-load function, ensuring the agent uses the freshest values.

These rules serve as a partnership agreement: guaranteeing no more time is wasted on early module load errors for environment secrets.
