// CommonJS wrapper to call ESM deployToNetlify
/**
 * @param {Object} opts
 */
module.exports.deployToNetlify = async function(opts) {
  const mod = await import('../../../src/js/auto-deploy.js');
  return mod.deployToNetlify(opts);
};
