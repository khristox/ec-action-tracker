// store/slices/menuSlice.js
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { menuService } from '../../services/menuService';

// ==================== Async Thunks ====================

// fetchUserMenus — no cache logic here.
// The Sidebar calls resetMenuState() before dispatching this, so the thunk
// just fetches unconditionally. The only guard is "don't fire if already loading".
export const fetchUserMenus = createAsyncThunk(
  'menu/fetchUserMenus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await menuService.getUserMenus();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
  {
    condition: (_, { getState }) => {
      const { menu } = getState();
      // Block duplicate in-flight requests only
      if (menu.loading) return false;
      return true;
    },
  }
);

export const fetchAllMenus = createAsyncThunk(
  'menu/fetchAllMenus',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const lastAdminFetch = state.menu.lastAdminFetch;
      const now = Date.now();
      const TTL = 5 * 60 * 1000;

      // Admin menu list changes rarely — keep a simple TTL cache here
      if (lastAdminFetch && (now - lastAdminFetch) < TTL && state.menu.allMenus.length > 0) {
        return state.menu.allMenus;
      }

      const response = await menuService.getAllMenus();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const forceRefreshMenus = createAsyncThunk(
  'menu/forceRefreshMenus',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      dispatch(clearCache());
      const response = await menuService.getUserMenus();
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

// ==================== Helper Functions ====================

const flattenMenus = (menus, parentPath = '') => {
  if (!menus || !Array.isArray(menus)) return [];

  let flat = [];
  for (const menu of menus) {
    flat.push({
      ...menu,
      fullPath: parentPath ? `${parentPath} > ${menu.title}` : menu.title,
      depth: parentPath ? parentPath.split(' > ').length : 0,
      hasChildren: menu.children && menu.children.length > 0,
    });
    if (menu.children && menu.children.length > 0) {
      flat = flat.concat(flattenMenus(menu.children, menu.fullPath || menu.title));
    }
  }
  return flat;
};

const searchMenus = (menus, query) => {
  if (!query || query.trim() === '') return menus;

  const lowerQuery = query.toLowerCase();

  const filterItems = (items) =>
    items
      .map(item => {
        const matchTitle = item.title?.toLowerCase().includes(lowerQuery);
        const matchCode  = item.code?.toLowerCase().includes(lowerQuery);
        const matchPath  = item.path?.toLowerCase().includes(lowerQuery);
        const match = matchTitle || matchCode || matchPath;

        const filteredChildren = item.children ? filterItems(item.children) : [];

        if (match || filteredChildren.length > 0) {
          return {
            ...item,
            children: filteredChildren,
            highlightMatch: match,
            matchType: matchTitle ? 'title' : matchCode ? 'code' : matchPath ? 'path' : null,
          };
        }
        return null;
      })
      .filter(Boolean);

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
};

// ==================== Slice ====================

const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
      state.filteredMenus = action.payload?.trim()
        ? searchMenus(state.menus, action.payload)
        : state.menus;
    },

    clearSearch: (state) => {
      state.searchQuery = '';
      state.filteredMenus = state.menus;
    },

    clearCache: (state) => {
      state.lastFetch = null;
      state.lastAdminFetch = null;
    },

    // Full reset — used by Sidebar on logout or user switch.
    // Returns a fresh copy of initialState so every field is wiped,
    // including lastFetch, so no stale cache timestamps survive.
    resetMenuState: () => ({ ...initialState }),

    updateMenuOrder: (state, action) => {
      const { menuId, newOrder } = action.payload;
      const updateOrder = (items) => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id === menuId) {
            items[i].order = newOrder;
            return true;
          }
          if (items[i].children && updateOrder(items[i].children)) return true;
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

    addMenuOptimistically: (state, action) => {
      state.menus.push(action.payload);
      state.flatMenus = flattenMenus(state.menus);
      state.filteredMenus = state.searchQuery
        ? searchMenus(state.menus, state.searchQuery)
        : state.menus;
    },

    removeMenuOptimistically: (state, action) => {
      const menuId = action.payload;
      const removeItem = (items) => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id === menuId) { items.splice(i, 1); return true; }
          if (items[i].children && removeItem(items[i].children)) return true;
        }
        return false;
      };
      removeItem(state.menus);
      state.flatMenus = flattenMenus(state.menus);
      state.filteredMenus = state.searchQuery
        ? searchMenus(state.menus, state.searchQuery)
        : state.menus;
    },
  },

  extraReducers: (builder) => {
    builder
      // ========== fetchUserMenus ==========
      .addCase(fetchUserMenus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserMenus.fulfilled, (state, action) => {
        const menus = action.payload || [];
        state.loading = false;
        state.menus = menus;
        state.filteredMenus = menus;
        state.flatMenus = flattenMenus(menus);
        state.lastFetch = Date.now();
        state.error = null;
      })
      .addCase(fetchUserMenus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch menus';
      })

      // ========== forceRefreshMenus ==========
      .addCase(forceRefreshMenus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(forceRefreshMenus.fulfilled, (state, action) => {
        const menus = action.payload || [];
        state.loading = false;
        state.menus = menus;
        state.filteredMenus = menus;
        state.flatMenus = flattenMenus(menus);
        state.lastFetch = Date.now();
        state.error = null;
      })
      .addCase(forceRefreshMenus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to refresh menus';
      })

      // ========== fetchAllMenus (Admin) ==========
      .addCase(fetchAllMenus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllMenus.fulfilled, (state, action) => {
        state.loading = false;
        state.allMenus = action.payload || [];
        state.lastAdminFetch = Date.now();
        state.error = null;
      })
      .addCase(fetchAllMenus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch all menus';
      })

      // ========== invalidateMenuCache ==========
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

// NOTE: slice name is 'menu' — use state.menu not state.menus
export const selectMenus         = (state) => state.menu.menus;
export const selectAllMenus      = (state) => state.menu.allMenus;
export const selectFlatMenus     = (state) => state.menu.flatMenus;
export const selectFilteredMenus = (state) => state.menu.filteredMenus;
export const selectMenuLoading   = (state) => state.menu.loading;
export const selectMenuError     = (state) => state.menu.error;
export const selectSearchQuery   = (state) => state.menu.searchQuery;
export const selectMenuCacheInfo = (state) => ({
  lastFetch:      state.menu.lastFetch,
  lastAdminFetch: state.menu.lastAdminFetch,
  cacheEnabled:   state.menu.cacheEnabled,
});

// Alias kept for any existing imports
export const selectMenusLoading = selectMenuLoading;

// ==================== Memoized Selectors ====================

const selectMenuState = (state) => state.menu;

export const selectHasMenus = createSelector(
  [selectMenuState],
  (menu) => Array.isArray(menu.menus) && menu.menus.length > 0
);

export const selectMainMenuItems = createSelector(
  [selectFilteredMenus],
  (menus) => menus.filter(menu => !menu.parent_id)
);

export const selectMenuByPath = createSelector(
  [selectFlatMenus, (_state, path) => path],
  (flatMenus, path) => flatMenus.find(menu => menu.path === path)
);

export const selectMenuById = createSelector(
  [selectFlatMenus, (_state, id) => id],
  (flatMenus, id) => flatMenus.find(menu => menu.id === id)
);

export const selectMenuBreadcrumb = createSelector(
  [selectFlatMenus, (_state, path) => path],
  (flatMenus, path) => {
    const menu = flatMenus.find(m => m.path === path);
    if (!menu) return [];
    return menu.fullPath?.split(' > ') || [];
  }
);

export const selectChildMenus = createSelector(
  [selectMenus, (_state, parentId) => parentId],
  (menus, parentId) => {
    const findChildren = (items) => {
      for (const item of items) {
        if (item.id === parentId) return item.children || [];
        if (item.children?.length > 0) {
          const found = findChildren(item.children);
          if (found.length > 0) return found;
        }
      }
      return [];
    };
    return findChildren(menus);
  }
);

export const selectSearchResults = createSelector(
  [selectFilteredMenus, selectSearchQuery],
  (menus, query) => {
    if (!query) return { results: menus, hasResults: menus.length > 0, query };

    const results = [];
    const searchInMenus = (items, parentTitle = '') => {
      for (const item of items) {
        const matches =
          item.title?.toLowerCase().includes(query.toLowerCase()) ||
          item.code?.toLowerCase().includes(query.toLowerCase()) ||
          item.path?.toLowerCase().includes(query.toLowerCase());

        if (matches) {
          results.push({
            ...item,
            parentContext: parentTitle,
            matchedField: item.title?.toLowerCase().includes(query.toLowerCase())
              ? 'title'
              : item.code?.toLowerCase().includes(query.toLowerCase())
              ? 'code'
              : 'path',
          });
        }
        if (item.children?.length > 0) {
          searchInMenus(item.children, item.title);
        }
      }
    };

    searchInMenus(menus);
    return { results, hasResults: results.length > 0, query };
  }
);

export const selectIsCacheValid = createSelector(
  [selectMenuCacheInfo],
  (cache) => {
    if (!cache.cacheEnabled || !cache.lastFetch) return false;
    return (Date.now() - cache.lastFetch) < 5 * 60 * 1000;
  }
);

export const selectMenuStats = createSelector(
  [selectMenus, selectFlatMenus],
  (menus, flatMenus) => ({
    totalMenus: flatMenus.length,
    rootMenus:  menus.length,
    maxDepth:   flatMenus.length > 0 ? Math.max(...flatMenus.map(m => m.depth || 0)) : 0,
    hasChildren: flatMenus.some(m => m.hasChildren),
  })
);

// ==================== Menu-Gating Selectors ====================
// Used by route guards (e.g. MenuProtectedRoute in App.jsx) to check
// "is this menu code / path in what the user is actually entitled to see?"
// Built off selectFlatMenus, which is already declared above, so these
// must stay below it in the file — referencing a const selector before its
// own declaration line runs throws a ReferenceError (temporal dead zone),
// regardless of where it sits in the exports.

export const selectAllowedMenuCodes = createSelector(
  [selectFlatMenus],
  (flatMenus) => new Set(flatMenus.filter(m => m.code).map(m => m.code))
);

export const selectAllowedMenuPaths = createSelector(
  [selectFlatMenus],
  (flatMenus) => new Set(flatMenus.filter(m => m.path).map(m => m.path))
);

export default menuSlice.reducer;