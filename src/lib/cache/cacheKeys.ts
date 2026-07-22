export const cacheKeys = {
  audit: (auditId: string) => `audit_cache_${auditId}`,
  brandList: () => `brands_cache`,
  auditList: (brandId: string) => `audit_list_cache_${brandId}`,
};
