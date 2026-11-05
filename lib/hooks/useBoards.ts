"use client"

import { useUser } from "@clerk/nextjs"
import { useEffect, useState } from "react";
import { Board } from "../supabase/models";
import { boardDataService, boardService } from "../services";
import { useSupabase } from "../supabase/SupabaseProvider";



export function useBoards(){

    const {user} = useUser();
    const {supabase} = useSupabase()
    const [boards, setBoards] = useState<Board[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(()=>{
        if(user) {
            loadBoards()
        }
    },[user, supabase])

    async function  loadBoards() {
        if(!user) return

        try{
            setLoading(true)
            setError(null)
            const data = await boardService.getBoards(supabase!, user.id)
            setBoards(data)
        }catch(err){
            setError(err instanceof Error ? err.message : "보드를 불러오지 못했습니다.")
        }finally{
            setLoading(false)
        }
    }

    async function  createBoard(boardData:{
        title: string,
        description?: string,
        color?: string
    }) {
        if(!user) throw new Error("사용자가 인증되지 않았습니다.")
        
        try{
            const newBoard = await boardDataService.createBoardWithDefaultColumns(
                supabase!,
                {
                ...boardData,
                userId: user?.id
                }
            )
            setBoards((prev) => [newBoard, ...prev])
        }catch(err){
            setError(err instanceof Error ? err.message : "보드를 생성하지 못했습니다.")
        }
    }

    return {boards, loading, error, createBoard}
}