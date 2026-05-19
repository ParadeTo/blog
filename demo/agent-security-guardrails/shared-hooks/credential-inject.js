export class SecureToolWrapper {
  static wrap(tool, credentials = {}) {
    if (!tool || typeof tool.execute !== 'function') {
      throw new Error('tool.execute is required');
    }

    const resolved = SecureToolWrapper.resolveCredentials(credentials);
    return {
      ...tool,
      execute: async (input = {}) => tool.execute({ ...input, ...resolved }),
    };
  }

  static resolveCredentials(credentials = {}) {
    return Object.fromEntries(
      Object.entries(credentials).map(([paramName, envName]) => {
        const value = process.env[envName];
        if (!value) {
          throw new Error(`Credential '${paramName}' requires env var '${envName}'`);
        }
        return [paramName, value];
      }),
    );
  }

  static getCredentialStatus(credentials = {}) {
    return Object.fromEntries(
      Object.entries(credentials).map(([paramName, envName]) => {
        const value = process.env[envName] ?? '';
        return [
          paramName,
          {
            env_var: envName,
            is_set: Boolean(value),
            length: value.length,
          },
        ];
      }),
    );
  }
}
