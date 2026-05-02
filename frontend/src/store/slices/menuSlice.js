// store/slices/menuSlice.js
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { menuService } from '../../services/menuService';

// ==================== Constants ====================

const CACHE_CONFIG = {
  TTL: 5 * 60 * 1000, // 5 minutes
  ENABLED: true,
};

// Track last user ID for cache invalidation
let lastUserId = null;

// ==================== Async Thunks ====================

export const fetchUserMenus = createAsyncThunk(
  'menu/fetchUserMenus',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const currentUserId = state.auth.user?.id;
      const lastFetch = state.menu.lastFetch;
      const now = Date.now();
      const userChanged = currentUserId && lastUserId && currentUserId !== lastUserId;
      
      // Invalidate cache if user changed
      if (userChanged) {
        lastUserId = currentUserId;
        // Force fresh fetch
        const response = await menuService.getUserMenus();
        return response;
      }
      
      // Check cache validity
      const isCacheValid = lastFetch && (now - lastFetch) < CACHE_CONFIG.TTL;
      
      if (CACHE_CONFIG.ENABLED && isCacheValid && state.menu.menus.length > 0 && !userChanged) {
        return state.menu.menus;
      }
      
      lastUserId = currentUserId;
      const response = await menuService.getUserMenus();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
  {
    condition: (_, { getState }) => {
      const { menu } = getState();
      if (menu.loading) {
        return false;
      }
      return true;
    }
  }
);

export const fetchAllMenus = createAsyncThunk(
  'menu/fetchAllMenus',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const lastAdminFetch = state.menu.lastAdminFetch;
      const now = Date.now();
      
      if (CACHE_CONFIG.ENABLED && lastAdminFetch && (now - lastAdminFetch) < CACHE_CONFIG.TTL && state.menu.allMenus.length > 0) {
        return state.menu.allMenus;
      }
      
      const response = await menuService.getAllMenus();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const invalidateMenuCache = createAsyncThunk(
  'menu/invalidateCache',
  async (_, { dispatch }) => {
    dispatch(clearCache());
    await dispatch(fetchUserMenus());
    return true;
  }
);

// ✅ NEW: Force refresh menus (bypasses cache)
export const forceRefreshMenus = createAsyncThunk(
  'menu/forceRefreshMenus',
  async (_, { dispatch }) => {
    dispatch(clearCache());
    lastUserId = null; // Reset user tracker
    const response = await menuService.getUserMenus();
    return response;
  }
);

// ==================== Helper Functions ====================

/**
 * Flatten menu hierarchy for searching
 */
const flattenMenus = (menus, parentPath = '') => {
  if (!menus || !Array.isArray(menus)) return [];
  
  let flat = [];
  for (const menu of menus) {
    flat.push({
      ...menu,
      fullPath: parentPath ? `${parentPath} > ${menu.title}` : menu.title,
      depth: parentPath.split(' > ').length,
      hasChildren: menu.children && menu.children.length > 0,
    });
    if (menu.children && menu.children.length > 0) {
      flat = flat.concat(flattenMenus(menu.children, menu.fullPath || menu.title));
    }
  }
  return flat;
};

/**
 * Build hierarchical tree from filtered items
 */
const buildTreeFromFiltered = (filteredMenus) => {
  if (!filteredMenus || filteredMenus.length === 0) return [];
  
  const menuMap = new Map();
  const roots = [];
  
  filteredMenus.forEach(menu => {
    menuMap.set(menu.id, { 
      ...menu, 
      children: [],
      originalChildren: menu.children || []
    });
  });
  
  filteredMenus.forEach(menu => {
    const mappedMenu = menuMap.get(menu.id);
    if (menu.parent_id && menuMap.has(menu.parent_id)) {
      const parent = menuMap.get(menu.parent_id);
      if (!parent.children.some(child => child.id === mappedMenu.id)) {
        parent.children.push(mappedMenu);
      }
    } else if (!menu.parent_id) {
      if (!roots.some(root => root.id === mappedMenu.id)) {
        roots.push(mappedMenu);
      }
    }
  });
  
  roots.sort((a, b) => (a.order || 0) - (b.order || 0));
  
  return roots;
};

/**
 * Search menus recursively with highlighting
 */
const searchMenus = (menus, query) => {
  if (!query || query.trim() === '') return menus;
  
  const lowerQuery = query.toLowerCase();
  
  const filterItems = (items) => {
    return items
      .map(item => {
        const matchTitle = item.title?.toLowerCase().includes(lowerQuery);
        const matchCode = item.code?.toLowerCase().includes(lowerQuery);
        const matchPath = item.path?.toLowerCase().includes(lowerQuery);
        const match = matchTitle || matchCode || matchPath;
        
        const filteredChildren = item.children ? filterItems(item.children) : [];
        
        if (match || filteredChildren.length > 0) {
          return { 
            ...item, 
            children: filteredChildren,
            highlightMatch: match,
            matchType: matchTitle ? 'title' : (matchCode ? 'code' : (matchPath ? 'path' : null))
          };
        }
        return null;
      })
      .filter(Boolean);
  };
  
  return filterItems(menus);
};

// ==================== Initial State ====================

const initialState = {
  menus: [],
  allMenus: [],
  flatMenus: [],
  filteredMenus: [],
  loading: false,
  error: null,
  searchQuery: '',
  lastFetch: null,
  lastAdminFetch: null,
  cacheEnabled: true,
  version: 1,
  lastUserId: null, // Track last user ID for cache invalidation
};

// ==================== Slice ====================

const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
      if (action.payload && action.payload.trim()) {
        state.filteredMenus = searchMenus(state.menus, action.payload);
      } else {
        state.filteredMenus = state.menus;
      }
    },
    
    clearSearch: (state) => {
      state.searchQuery = '';
      state.filteredMenus = state.menus;
    },
    
    clearCache: (state) => {
      state.lastFetch = null;
      state.lastAdminFetch = null;
      state.lastUserId = null;
      state.menus = [];
      state.allMenus = [];
      state.flatMenus = [];
      state.filteredMenus = [];
    },
    
    resetMenuState: (state) => {
      lastUserId = null;
      return { ...initialState };
    },
    
    updateMenuOrder: (state, action) => {
      const { menuId, newOrder } = action.payload;
      const updateOrder = (items) => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id === menuId) {
            items[i].order = newOrder;
            return true;
          }
          if (items[i].children && updateOrder(items[i].children)) {
            return true;
          }
        }
        return false;
      };
      updateOrder(state.menus);
      updateOrder(state.filteredMenus);
      state.flatMenus = flattenMenus(state.menus);
    },
    
    setCacheEnabled: (state, action) => {
      state.cacheEnabled = action.payload;
    },
    
    // ✅ NEW: Optimistic update for menu items
    addMenuOptimistically: (state, action) => {
      const newMenu = action.payload;
      state.menus.push(newMenu);
      state.flatMenus = flattenMenus(state.menus);
      state.filteredMenus = state.searchQuery ? searchMenus(state.menus, state.searchQuery) : state.menus;
    },
    
    removeMenuOptimistically: (state, action) => {
      const menuId = action.payload;
      const removeItem = (items) => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id === menuId) {
            items.splice(i, 1);
            return true;
          }
          if (items[i].children && removeItem(items[i].children)) {
            return true;
          }
        }
        return false;
      };
      removeItem(state.menus);
      state.flatMenus = flattenMenus(state.menus);
      state.filteredMenus = state.searchQuery ? searchMenus(state.menus, state.searchQuery) : state.menus;
    },
  },
  
  extraReducers: (builder) => {
    builder
      // ========== Fetch User Menus ==========
      .addCase(fetchUserMenus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserMenus.fulfilled, (state, action) => {
        state.loading = false;
        state.menus = action.payload || [];
        state.filteredMenus = action.payload || [];
        state.flatMenus = flattenMenus(action.payload || []);
        
        if (state.cacheEnabled) {
          state.lastFetch = Date.now();
        }
        
        state.error = null;
      })
      .addCase(fetchUserMenus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch menus';
      })
      
      // ========== Force Refresh Menus ==========
      .addCase(forceRefreshMenus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(forceRefreshMenus.fulfilled, (state, action) => {
        state.loading = false;
        state.menus = action.payload || [];
        state.filteredMenus = action.payload || [];
        state.flatMenus = flattenMenus(action.payload || []);
        state.lastFetch = Date.now();
        state.error = null;
      })
      .addCase(forceRefreshMenus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to refresh menus';
      })
      
      // ========== Fetch All Menus (Admin) ==========
      .addCase(fetchAllMenus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllMenus.fulfilled, (state, action) => {
        state.loading = false;
        state.allMenus = action.payload || [];
        
        if (state.cacheEnabled) {
          state.lastAdminFetch = Date.now();
        }
        
        state.error = null;
      })
      .addCase(fetchAllMenus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch all menus';
      })
      
      // ========== Invalidate Cache ==========
      .addCase(invalidateMenuCache.fulfilled, (state) => {
        state.error = null;
      });
  },
});

// ==================== Actions ====================
export const { 
  setSearchQuery, 
  clearSearch, 
  clearCache, 
  resetMenuState,
  updateMenuOrder,
  setCacheEnabled,
  addMenuOptimistically,
  removeMenuOptimistically,
} = menuSlice.actions;

// ==================== Base Selectors ====================

export const selectMenus = (state) => state.menu.menus;
export const selectAllMenus = (state) => state.menu.allMenus;
export const selectFlatMenus = (state) => state.menu.flatMenus;
export const selectFilteredMenus = (state) => state.menu.filteredMenus;
export const selectMenuLoading = (state) => state.menu.loading;
export const selectMenuError = (state) => state.menu.error;
export const selectSearchQuery = (state) => state.menu.searchQuery;
export const selectMenuCacheInfo = (state) => ({
  lastFetch: state.menu.lastFetch,
  lastAdminFetch: state.menu.lastAdminFetch,
  cacheEnabled: state.menu.cacheEnabled,
});

// ==================== Memoized Selectors ====================

const selectMenuState = (state) => state.menu;

export const selectHasMenus = createSelector(
  [selectMenuState],
  (menu) => menu.menus && menu.menus.length > 0
);

export const selectMainMenuItems = createSelector(
  [selectFilteredMenus],
  (menus) => menus.filter(menu => !menu.parent_id || menu.parent_id === null)
);

export const selectMenuByPath = createSelector(
  [selectFlatMenus, (state, path) => path],
  (flatMenus, path) => flatMenus.find(menu => menu.path === path)
);

export const selectMenuById = createSelector(
  [selectFlatMenus, (state, id) => id],
  (flatMenus, id) => flatMenus.find(menu => menu.id === id)
);

export const selectMenuBreadcrumb = createSelector(
  [selectFlatMenus, (state, path) => path],
  (flatMenus, path) => {
    const menu = flatMenus.find(m => m.path === path);
    if (!menu) return [];
    return menu.fullPath?.split(' > ') || [];
  }
);

export const selectChildMenus = createSelector(
  [selectMenus, (state, parentId) => parentId],
  (menus, parentId) => {
    const findChildren = (items) => {
      for (const item of items) {
        if (item.id === parentId) {
          return item.children || [];
        }
        if (item.children && item.children.length > 0) {
          const found = findChildren(item.children);
          if (found) return found;
        }
      }
      return [];
    };
    return findChildren(menus);
  }
);

// ✅ NEW: Search results with metadata
export const selectSearchResults = createSelector(
  [selectFilteredMenus, selectSearchQuery],
  (menus, query) => {
    if (!query) return { results: menus, hasResults: menus.length > 0, query };
    
    const results = [];
    const searchInMenus = (items, parentTitle = '') => {
      for (const item of items) {
        const matches = item.title?.toLowerCase().includes(query.toLowerCase()) ||
                       item.code?.toLowerCase().includes(query.toLowerCase()) ||
                       item.path?.toLowerCase().includes(query.toLowerCase());
        
        if (matches) {
          results.push({
            ...item,
            parentContext: parentTitle,
            matchedField: item.title?.toLowerCase().includes(query.toLowerCase()) ? 'title'
                         : item.code?.toLowerCase().includes(query.toLowerCase()) ? 'code'
                         : 'path'
          });
        }
        if (item.children && item.children.length > 0) {
          searchInMenus(item.children, item.title);
        }
      }
    };
    
    searchInMenus(menus);
    return { results, hasResults: results.length > 0, query };
  }
);

// ✅ NEW: Check if cache is valid
export const selectIsCacheValid = createSelector(
  [selectMenuCacheInfo],
  (cache) => {
    if (!cache.cacheEnabled) return false;
    const now = Date.now();
    return cache.lastFetch && (now - cache.lastFetch) < CACHE_CONFIG.TTL;
  }
);

// ✅ NEW: Get menu statistics
export const selectMenuStats = createSelector(
  [selectMenus, selectFlatMenus],
  (menus, flatMenus) => ({
    totalMenus: flatMenus.length,
    rootMenus: menus.length,
    maxDepth: Math.max(...flatMenus.map(m => m.depth || 0), 0),
    hasChildren: flatMenus.some(m => m.hasChildren),
  })
);

export default menuSlice.reducer;