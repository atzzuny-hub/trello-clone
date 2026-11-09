'use client'

import { useSession } from "@clerk/nextjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useState } from "react";



type SupabaseContext = {
    supabase: SupabaseClient | null;
    isLoaded: boolean
}

const Context = createContext<SupabaseContext>({
    supabase: null, isLoaded: false
});

export default function SupabaseProvider({children}:{children:React.ReactNode}){

    const {session, isLoaded: isSessionLoaded} = useSession();
    const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
    const [isLoaded, setIsLoaded] = useState<boolean>(false)

    useEffect(()=>{
        // if(!session) return;

        // Clerk가 로그인 상태를 아직 확인하는 중이면 기다린다
        if(!isSessionLoaded) return;

        // 로그아웃 상태면 Supabase 없이 화면을 보여 준다 (로그인 버튼이 보여야 하므로)
        if(!session) {
            setSupabase(null)
            setIsLoaded(true)
            return;
        }

        const client = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                accessToken: async () => session?.getToken() ?? null
            }
        )

        setSupabase(client)
        setIsLoaded(true)
    },[session])

    return(
        <Context.Provider value={{supabase, isLoaded}}>
            {!isLoaded ? <div> Loading... </div> : children} 
        </Context.Provider>

    ) 
}

export const useSupabase = () => {
    const context = useContext(Context)
    if(context === undefined) {
        throw new Error("useSupabase는 provider 내부에 있어야 합니다.")
    }

    return context;
}