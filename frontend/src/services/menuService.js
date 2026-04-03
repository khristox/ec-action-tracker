// services/menuService.js
import apiClient from '../store/api/apiClient'; // Adjust path as needed


export const menuService = {
  // Get menus for current user (automatically filtered by role)
  getUserMenus: async () => {
    const response = await apiClient.get('/menus/');
    return response.data;
  },
  
  // Get all menus (admin only)
  getAllMenus: async () => {
    const response = await apiClient.get('/menus/all');
    return response.data;
  },
  
  // Get menu by ID
  getMenuById: async (menuId) => {
    const response = await apiClient.get(`/menus/${menuId}`);
    return response.data;
  },
  
  // Create menu (admin only)
  createMenu: async (menuData) => {
    const response = await apiClient.post('/menus/', menuData);
    return response.data;
  },
  
  // Update menu (admin only)
  updateMenu: async (menuId, menuData) => {
    const response = await apiClient.put(`/menus/${menuId}`, menuData);
    return response.data;
  },
  
  // Delete menu (admin only)
  deleteMenu: async (menuId) => {
    const response = await apiClient.delete(`/menus/${menuId}`);
    return response.data;
  }
};