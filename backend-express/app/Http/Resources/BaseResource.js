/**
 * BaseResource - Formats model data like Laravel BaseResource
 * This is a shared resource used by all modules
 * Match Laravel: backend-laravel/app/Http/Resources/BaseResource.php
 */
class BaseResource {
    /**
     * Format single model data like Laravel BaseResource.toArray()
     * Converts timestamps to Unix timestamp (seconds)
     * Handles logo/image URL conversion if fields exist
     *
     * @param {Object|Array} data - Model instance, plain object, or array
     * @returns {Object|Array|null} Formatted data with Unix timestamps, or array as-is
     */
    static format(data) {
        if (!data) return null;

        // Keep primitive values as-is (e.g. array of strings from UnitPrice getCodeEspecially)
        if (typeof data !== 'object') {
            return data;
        }

        // If an array is provided, mirror Laravel behavior for plain collections:
        // return an array with each element formatted (primitives preserved).
        if (Array.isArray(data)) {
            return data.map(item => (typeof item === 'object' ? this.format(item) : item));
        }

        // Handle arrays: Laravel BaseResource with array returns array as-is
        // Match Laravel: When BaseResource receives array, toArray() returns array as-is
        if (Array.isArray(data)) {
            return data;
        }

        // Handle Sequelize model instances
        const plainData = data.toJSON ? data.toJSON() : { ...data };
        const formatted = { ...plainData };

        // Convert timestamps to Unix timestamp (seconds)
        // Match Laravel: $this->created_at->getTimestamp()
        // Handle both snake_case (created_at) and camelCase (createdAt) from Sequelize
        const createdAt = formatted.created_at || formatted.createdAt;
        const updatedAt = formatted.updated_at || formatted.updatedAt;
        const deletedAt = formatted.deleted_at || formatted.deletedAt;

        if (createdAt) {
            formatted.created_at = Math.floor(new Date(createdAt).getTime() / 1000);
            delete formatted.createdAt; // Remove camelCase version
        }
        if (updatedAt) {
            formatted.updated_at = Math.floor(new Date(updatedAt).getTime() / 1000);
            delete formatted.updatedAt; // Remove camelCase version
        }
        if (deletedAt) {
            formatted.deleted_at = Math.floor(new Date(deletedAt).getTime() / 1000);
            delete formatted.deletedAt; // Remove camelCase version
        }

        // Handle logo/image URLs if present (for models that have these fields)
        // Match Laravel: $this->logo_url, $this->image_url
        if (formatted.logo) {
            formatted.logo = formatted.logo_url || formatted.logo;
        }
        if (formatted.image) {
            formatted.image = formatted.image_url || formatted.image;
        }

        return formatted;
    }

    /**
     * Format collection of models like Laravel BaseResource.collection()
     * Match Laravel: backend-laravel/app/Http/Resources/BaseResource.php (lines 42-53)
     *
     * In Laravel:
     * - If resource is LengthAwarePaginator → calls ResponseService::responsePaginate($result, $resource)
     *   Returns: ['result' => $result, 'pagination' => [...]]
     * - If resource is collection → returns ['result' => $result]
     *
     * @param {Object|Array} resource - Resource data from repository
     *   - If Object with pagination: { result: [...], pagination: {...} } (from repository)
     *   - If Array: [...] (non-paginated collection)
     * @returns {Object} Formatted response
     *   - If paginated: { result: [...], pagination: {...} } (via ResponseService.responsePaginate)
     *   - If not paginated: { result: [...] }
     */
    static collectionData(resource) {
        const ResponseService = require('../../Helpers/ResponseService');

        // Handle null/undefined
        if (!resource) {
            return { result: [] };
        }

        // If resource is an array (non-paginated collection)
        // Match Laravel: BaseResource::collection($collection) where $collection is not LengthAwarePaginator
        if (Array.isArray(resource)) {
            // Format each item using toArray() equivalent (format method)
            const formattedItems = resource.map(item => this.format(item));
            return { result: formattedItems };
        }

        // If resource is an object with pagination structure (paginated data from repository)
        // Match Laravel: BaseResource::collection($paginator) where $paginator is LengthAwarePaginator
        if (resource.pagination && (resource.result || resource.data)) {
            // Get items (support both 'result' and 'data' keys for backward compatibility)
            const items = resource.result || resource.data || [];

            // Format items using toArray() equivalent (format method)
            const formattedItems = items.map(item => this.format(item));

            // Extract pagination info
            const pagination = resource.pagination;
            const page = pagination.current_page || 1;
            const perPage = pagination.per_page || 15;
            const total = pagination.total_records || pagination.total || 0;

            // Call ResponseService.responsePaginate() to match Laravel behavior
            // Match Laravel: ResponseService::responsePaginate($result, LengthAwarePaginator $resource)
            // Laravel passes the formatted result and the paginator object
            return ResponseService.responseJsonPaginated(formattedItems, page, perPage, total);
        }

        // If resource has result/data but no pagination (non-paginated object)
        if (resource.result || resource.data) {
            const items = resource.result || resource.data;
            const formattedItems = Array.isArray(items)
                ? items.map(item => this.format(item))
                : [this.format(items)];
            return { result: formattedItems };
        }

        // Fallback: treat as single item or array
        const formattedItems = Array.isArray(resource)
            ? resource.map(item => this.format(item))
            : [this.format(resource)];
        return { result: formattedItems };
    }

    /**
     * Format collection of models like Laravel BaseResource.collection()
     * Supports both Pattern A and Pattern B
     * Match Laravel: BaseResource::collection($resource)
     *
     * @param {Array|Object} resource - Can be:
     *   - Plain array (non-paginated collection) - Match Laravel Collection
     *   - Object with 'result' property (already wrapped array)
     *   - Object with 'data' property (paginated data)
     *   - Object with pagination metadata
     * @param {string} pattern - 'A' for Laravel LengthAwarePaginator structure, 'B' for custom pagination structure
     * @param {Object} req - Express request object (optional, required for Pattern A to generate URLs)
     * @returns {Object} Formatted response with items and pagination
     */
    static collection(resource, pattern = 'A', req = null) {
        // Handle plain array (non-paginated collection) - Match Laravel BaseResource::collection() when not LengthAwarePaginator
        // Laravel: if ($resource instanceof LengthAwarePaginator) { ... } else { return ['result' => $result]; }
        if (Array.isArray(resource)) {
            const formattedItems = resource.map(item => this.format(item));
            return {
                result: formattedItems
            };
        }

        // Handle object with 'result' property (already wrapped array) - Match Laravel parent::collection() result
        if (resource && resource.result && Array.isArray(resource.result)) {
            const formattedItems = resource.result.map(item => this.format(item));
            return {
                result: formattedItems
            };
        }

        // Handle paginated data (object with 'data' property)
        const paginatedData = resource;
        if (!paginatedData || !paginatedData.data) {
            if (pattern === 'A') {
                // Pattern A: Return empty structure matching Laravel LengthAwarePaginator
                return {
                    data: [],
                    current_page: 1,
                    first_page_url: null,
                    from: null,
                    last_page: 1,
                    last_page_url: null,
                    links: [],
                    next_page_url: null,
                    path: null,
                    per_page: 15,
                    prev_page_url: null,
                    to: null,
                    total: 0
                };
            } else {
                // Pattern B: Return custom pagination structure
                return {
                    result: [],
                    pagination: paginatedData?.pagination || {}
                };
            }
        }

        const formattedItems = paginatedData.data.map(item => this.format(item));

        // Pattern A: new BaseResource($pagination) - Laravel automatically serializes LengthAwarePaginator
        // Returns all LengthAwarePaginator properties at the same level as "data"
        // Match Laravel: When JsonResource receives LengthAwarePaginator, it serializes all public properties
        if (pattern === 'A') {
            const pagination = paginatedData.pagination || {};
            const currentPage = pagination.current_page || 1;
            const perPage = pagination.per_page || 15;
            const total = pagination.total_records || pagination.total || 0;
            const lastPage = pagination.total_pages || pagination.last_page || 1;
            const from = pagination.from || (currentPage === 1 && total > 0 ? 1 : null);
            const to = pagination.to || (currentPage === lastPage && total > 0 ? total : null);

            // Build URLs from request (like Laravel LengthAwarePaginator does)
            let path = null;
            let firstPageUrl = null;
            let lastPageUrl = null;
            let nextPageUrl = null;
            let prevPageUrl = null;
            let links = [];

            if (req) {
                // Get base URL and path from request (like Laravel request()->url(), request()->path())
                const protocol = req.protocol || (req.secure ? 'https' : 'http');
                const host = req.get('host') || 'localhost';
                const baseUrl = `${protocol}://${host}`;
                path = `${baseUrl}${req.path || '/api/course'}`;

                // Build query string (preserve existing query params except page)
                const query = { ...req.query };
                delete query.page; // Remove page from query to build clean URLs

                const queryString = Object.keys(query).length > 0
                    ? '?' + new URLSearchParams(query).toString()
                    : '';

                const pageParam = queryString ? '&' : '?';

                firstPageUrl = `${path}${queryString}${pageParam}page=1`;
                lastPageUrl = `${path}${queryString}${pageParam}page=${lastPage}`;

                if (currentPage < lastPage) {
                    nextPageUrl = `${path}${queryString}${pageParam}page=${currentPage + 1}`;
                }

                if (currentPage > 1) {
                    prevPageUrl = `${path}${queryString}${pageParam}page=${currentPage - 1}`;
                }

                // Build links array (simplified version matching Laravel structure)
                if (lastPage > 1) {
                    // Previous link
                    links.push({
                        url: prevPageUrl,
                        label: '&laquo; Previous',
                        active: false
                    });

                    // Page number links (show current page and adjacent pages)
                    const startPage = Math.max(1, currentPage - 2);
                    const endPage = Math.min(lastPage, currentPage + 2);

                    for (let i = startPage; i <= endPage; i++) {
                        const pageUrl = `${path}${queryString}${pageParam}page=${i}`;
                        links.push({
                            url: pageUrl,
                            label: String(i),
                            active: i === currentPage
                        });
                    }

                    // Next link
                    links.push({
                        url: nextPageUrl,
                        label: 'Next &raquo;',
                        active: false
                    });
                }
            }

            return {
                data: formattedItems,
                current_page: currentPage,
                first_page_url: firstPageUrl,
                from: from,
                last_page: lastPage,
                last_page_url: lastPageUrl,
                links: links,
                next_page_url: nextPageUrl,
                prev_page_url: prevPageUrl,
                path: path,
                per_page: perPage,
                to: to,
                total: total
            };
        } else {
            // Pattern B: Resource::collection($pagination) - Custom format with "result" and "pagination"
            // Match Laravel: ResponseService::responsePaginate($result, LengthAwarePaginator $resource)
            // Check if paginatedData is LengthAwarePaginator-like format (from Common::pagination)
            if (paginatedData.total !== undefined && paginatedData.per_page !== undefined && paginatedData.current_page !== undefined) {
                // LengthAwarePaginator-like format - convert to Pattern B
                return {
                    result: formattedItems,
                    pagination: {
                        display: paginatedData.data?.length || 0,
                        total_records: paginatedData.total || 0,
                        per_page: paginatedData.per_page || 15,
                        current_page: paginatedData.current_page || 1,
                        total_pages: paginatedData.last_page || 1
                    }
                };
            } else {
                // Custom pagination format (already has pagination object)
                return {
                    result: formattedItems,
                    pagination: paginatedData.pagination
                };
            }
        }
    }
}

module.exports = BaseResource;
