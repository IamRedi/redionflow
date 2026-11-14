export const PUBLIC_DEMO_INDEXING_HEADERS = [{
  source: '/:path*',
  has: [{type:'host',value:'(?:redionflow-production\\.up\\.railway\\.app|bauflow-production-1344\\.up\\.railway\\.app)'}],
  headers: [{key:'X-Robots-Tag',value:'noindex, follow'}],
}];
