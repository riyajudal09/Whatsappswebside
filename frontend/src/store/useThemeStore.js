// import { create } from "zustand";
// import { persist } from "zustand/middleware";

// const useThemeStore = create(
//   persist(
//     (set) => ({
//       theme: 'light',
//       setTheme: (theme) => set({ theme }),
//     }),
//     {
//       name: "theme-storage",
//       getStorage: () => localStorage
//     }
//   )
// );

// export default useThemeStore;

// import { create } from "zustand";
// import { persist, createJSONStorage } from "zustand/middleware";

// const useThemeStore = create(
//   persist(
//     (set) => ({
//       theme: 'light',
//       setTheme: (theme) => set({ theme }),
//       toggleTheme: () =>
//         set((state) => ({
//           theme: state.theme === 'light' ? 'dark' : 'light',
//         })),
//     }),
//     {
//       name: "theme-storage",
//       // Modern Zustand v4+ syntax for storage:
//       storage: createJSONStorage(() => localStorage),
//     }
//   )
// );

// export default useThemeStore;

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),
    }),
    {
      name: "theme-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useThemeStore;