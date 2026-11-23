export default { join: (...p) => p.join('/'), resolve: (...p) => p.join('/'), dirname: (p) => p.split('/').slice(0, -1).join('/') };
