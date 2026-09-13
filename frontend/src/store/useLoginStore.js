// import { create } from 'zustand';
// import { persist } from 'zustand/middleware';

// const userLoginStore = create(
//     persist(
//         (set) => ({
//             step: 1,
//             userPhoneData: null,
//             setStep: (step) => set({ step }),
//             setUserPhoneData: (data) => set({ userPhoneData: data }),
//             resetLoginState: () => set({ step: 1, userPhoneData }),

//         }),
//         {
//             name: "login-storage",
//             partialize: (state) => ({ step: state.step, userPhoneData: state.userPhoneData, })
//         }
//     )
// );

// export default userLoginStore;


// import { create } from 'zustand';
// import { persist } from 'zustand/middleware';

// const userLoginStore = create(
//     persist(
//         (set) => ({
//             step: 1,
//             userPhoneData: null,
//             setStep: (step) => set({ step }),
//             setUserPhoneData: (data) => set({ userPhoneData: data }),
//             // Reset state back to initial values:
//             resetLoginState: () => set({ step: 1, userPhoneData: null }),
//         }),
//         {
//             name: "login-storage",
//             partialize: (state) => ({ 
//                 step: state.step, 
//                 userPhoneData: state.userPhoneData 
//             })
//         }
//     )
// );

// export default userLoginStore; 

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useLoginStore = create(
  persist(
    (set) => ({
      step: 1,
      userPhoneData: null,
      setStep: (step) => set({ step }),
      setUserPhoneData: (data) => set({ userPhoneData: data }),
      // Reset state back to initial values:
      resetLoginState: () => set({ step: 1, userPhoneData: null }),
    }),
    {
      name: "login-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        step: state.step, 
        userPhoneData: state.userPhoneData 
      })
    }
  )
);

export default useLoginStore;