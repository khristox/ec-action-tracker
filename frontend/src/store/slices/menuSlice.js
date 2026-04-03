// store/slices/menuSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { menuService } from '../../services/menuService';

export const fetchUserMenus = createAsyncThunk(
  'menu/fetchUserMenus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await menuService.getUserMenus();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchAllMenus = createAsyncThunk(
  'menu/fetchAllMenus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await menuService.getAllMenus();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const initialState = {
  menus: [],           // User's accessible menus (filtered by role)
  allMenus: [],        // All menus (admin only)
  flatMenus: [],       // Flattened list for searching
  loading: false,
  error: null,
  searchQuery: '',
};

const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    clearSearch: (state) => {
      state.searchQuery = '';
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch user menus
      .addCase(fetchUserMenus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserMenus.fulfilled, (state, action) => {
        state.loading = false;
        state.menus = action.payload;
        // Create flat list for searching
        state.flatMenus = flattenMenus(action.payload);
      })
      .addCase(fetchUserMenus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch all menus (admin)
      .addCase(fetchAllMenus.fulfilled, (state, action) => {
        state.allMenus = action.payload;
      });
  },
});

// Helper function to flatten menu hierarchy
const flattenMenus = (menus, parentPath = '') => {
  let flat = [];
  for (const menu of menus) {
    flat.push({
      ...menu,
      fullPath: parentPath ? `${parentPath} > ${menu.title}` : menu.title,
    });
    if (menu.children && menu.children.length > 0) {
      flat = flat.concat(flattenMenus(menu.children, menu.title));
    }
  }
  return flat;
};

export const { setSearchQuery, clearSearch } = menuSlice.actions;
export default menuSlice.reducer;

// Selectors
export const selectMenus = (state) => state.menu.menus;
export const selectFlatMenus = (state) => state.menu.flatMenus;
export const selectMenuLoading = (state) => state.menu.loading;
export const selectSearchQuery = (state) => state.menu.searchQuery;
export const selectFilteredMenus = (state) => {
  const query = state.menu.searchQuery.toLowerCase();
  if (!query) return state.menu.menus;
  
  const filtered = state.menu.flatMenus.filter(menu =>
    menu.title.toLowerCase().includes(query) ||
    menu.code?.toLowerCase().includes(query) ||
    menu.fullPath?.toLowerCase().includes(query)
  );
  
  return buildTreeFromFiltered(filtered);
};

const buildTreeFromFiltered = (filteredMenus) => {
  const menuMap = new Map();
  const roots = [];
  
  filteredMenus.forEach(menu => {
    menuMap.set(menu.id, { ...menu, children: [] });
  });
  
  filteredMenus.forEach(menu => {
    if (menu.parent_id && menuMap.has(menu.parent_id)) {
      menuMap.get(menu.parent_id).children.push(menuMap.get(menu.id));
    } else if (!menu.parent_id) {
      roots.push(menuMap.get(menu.id));
    }
  });
  
  return roots;
};