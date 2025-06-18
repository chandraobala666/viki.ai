/**
 * Simple HTTP API Library
 * Provides simple functions for HTTP operations with JSON input/output
 * Includes error logging to console
 */

/**
 * Default configuration
 */
const defaultConfig = {
    baseUrl: '',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    timeout: 180000 // 3 minutes
};

/**
 * Log request details
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {Object} data - Request data
 */
function logRequest(method, url, data = null) {
    console.log(`🚀 ${method.toUpperCase()} ${url}`);
    if (data) {
        console.log('📤 Request Data:', JSON.stringify(data, null, 2));
    }
}

/**
 * Log response details
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {number} status - Response status
 * @param {Object} data - Response data
 */
function logResponse(method, url, status, data) {
    console.log(`✅ ${method.toUpperCase()} ${url} - Status: ${status}`);
    console.log('📥 Response Data:', JSON.stringify(data, null, 2));
}

/**
 * Log error details
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {Error} error - Error object
 */
function logError(method, url, error) {
    console.error(`❌ ${method.toUpperCase()} ${url} - Error:`, {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
}

/**
 * Make HTTP request with timeout
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
function fetchWithTimeout(url, options, timeout = defaultConfig.timeout) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
        )
    ]);
}

/**
 * Parse response and handle different content types
 * @param {Response} response - Fetch response
 * @returns {Promise<any>} Parsed response data
 */
async function parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    
    try {
        if (contentType.includes('application/json')) {
            return await response.json();
        } else if (contentType.includes('text/')) {
            return await response.text();
        } else if (response.status === 204) { // No Content
            return null;
        } else {
            return await response.text(); // Fallback to text
        }
    } catch (parseError) {
        console.warn('⚠️ Failed to parse response:', parseError.message);
        return null;
    }
}

/**
 * Perform GET request
 * @param {string} url - Request URL
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response object with status and data
 */
async function get(url, options = {}) {
    const fullUrl = (options.baseUrl || defaultConfig.baseUrl) + url;
    const headers = { ...defaultConfig.headers, ...options.headers };
    
    // Add query parameters if provided
    let requestUrl = fullUrl;
    if (options.params) {
        const queryParams = new URLSearchParams(options.params);
        requestUrl += (requestUrl.includes('?') ? '&' : '?') + queryParams.toString();
    }
    
    logRequest('GET', requestUrl);
    
    try {
        const response = await fetchWithTimeout(requestUrl, {
            method: 'GET',
            headers,
            ...options.fetchOptions
        }, options.timeout);
        
        const data = await parseResponse(response);
        
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.statusText = response.statusText;
            error.data = data;
            throw error;
        }
        
        logResponse('GET', requestUrl, response.status, data);
        
        return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data
        };
        
    } catch (error) {
        logError('GET', requestUrl, error);
        throw error;
    }
}

/**
 * Perform POST request
 * @param {string} url - Request URL
 * @param {Object|FormData} data - Request data (JSON object or FormData)
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response object with status and data
 */
async function post(url, data, options = {}) {
    const fullUrl = (options.baseUrl || defaultConfig.baseUrl) + url;
    let headers = { ...defaultConfig.headers, ...options.headers };
    let body;
    
    // Handle FormData differently from JSON data
    if (data instanceof FormData) {
        // For FormData, don't set Content-Type header (let browser set it with boundary)
        delete headers['Content-Type'];
        body = data;
    } else {
        // For JSON data, stringify it
        body = JSON.stringify(data);
    }
    
    logRequest('POST', fullUrl, data);
    
    try {
        const response = await fetchWithTimeout(fullUrl, {
            method: 'POST',
            headers,
            body,
            ...options.fetchOptions
        }, options.timeout);
        
        const responseData = await parseResponse(response);
        
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.statusText = response.statusText;
            error.data = responseData;
            throw error;
        }
        
        logResponse('POST', fullUrl, response.status, responseData);
        
        return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data: responseData
        };
        
    } catch (error) {
        logError('POST', fullUrl, error);
        throw error;
    }
}

/**
 * Perform PUT request
 * @param {string} url - Request URL
 * @param {Object} data - Request data (JSON)
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response object with status and data
 */
async function put(url, data, options = {}) {
    const fullUrl = (options.baseUrl || defaultConfig.baseUrl) + url;
    const headers = { ...defaultConfig.headers, ...options.headers };
    
    logRequest('PUT', fullUrl, data);
    
    try {
        const response = await fetchWithTimeout(fullUrl, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data),
            ...options.fetchOptions
        }, options.timeout);
        
        const responseData = await parseResponse(response);
        
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.statusText = response.statusText;
            error.data = responseData;
            throw error;
        }
        
        logResponse('PUT', fullUrl, response.status, responseData);
        
        return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data: responseData
        };
        
    } catch (error) {
        logError('PUT', fullUrl, error);
        throw error;
    }
}

/**
 * Perform DELETE request
 * @param {string} url - Request URL
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response object with status and data
 */
async function deleteRequest(url, options = {}) {
    const fullUrl = (options.baseUrl || defaultConfig.baseUrl) + url;
    const headers = { ...defaultConfig.headers, ...options.headers };
    
    logRequest('DELETE', fullUrl);
    
    try {
        const response = await fetchWithTimeout(fullUrl, {
            method: 'DELETE',
            headers,
            ...options.fetchOptions
        }, options.timeout);
        
        const responseData = await parseResponse(response);
        
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.statusText = response.statusText;
            error.data = responseData;
            throw error;
        }
        
        logResponse('DELETE', fullUrl, response.status, responseData);
        
        return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data: responseData
        };
        
    } catch (error) {
        logError('DELETE', fullUrl, error);
        throw error;
    }
}

/**
 * Configure default settings
 * @param {Object} config - Configuration object
 */
function configure(config) {
    Object.assign(defaultConfig, config);
}

/**
 * Create an API client with base configuration
 * @param {Object} config - Base configuration
 * @returns {Object} API client object
 */
function createApiClient(config = {}) {
    const clientConfig = { ...defaultConfig, ...config };
    
    return {
        get: (url, options = {}) => get(url, { ...clientConfig, ...options }),
        post: (url, data, options = {}) => post(url, data, { ...clientConfig, ...options }),
        put: (url, data, options = {}) => put(url, data, { ...clientConfig, ...options }),
        delete: (url, options = {}) => deleteRequest(url, { ...clientConfig, ...options }),
        configure: (newConfig) => Object.assign(clientConfig, newConfig)
    };
}

// Export functions
export {
    get,
    post,
    put,
    deleteRequest as delete,
    configure,
    createApiClient
};

// Make available globally for non-module usage
if (typeof window !== 'undefined') {
    window.apiClient = {
        get,
        post,
        put,
        delete: deleteRequest,
        configure,
        createApiClient
    };
}
