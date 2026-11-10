"use client"

import { useUser } from "@clerk/nextjs"
import { useEffect, useState } from "react";
import { Board, Column, ColumnWithTasks } from "../supabase/models";
import { boardDataService, boardService, taskService } from "../services";
import { useSupabase } from "../supabase/SupabaseProvider";
import { describe } from "node:test";



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

export function useBoard(boardId: string){
    const {supabase} = useSupabase()
    const [board, setBoard] = useState<Board | null>(null)
    const [columns, setColumns] = useState<ColumnWithTasks[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(()=>{
        if(boardId) {
            loadBoard()
        }
    },[boardId, supabase])

    async function  loadBoard() {
        if(!boardId) return

        try{
            setLoading(true)
            setError(null)
            const data = await boardDataService.getBoardWithColumns(supabase!, boardId)
            setBoard(data.board)
            setColumns(data.columnsWithTasks)
        }catch(err){
            setError(err instanceof Error ? err.message : "보드를 불러오지 못했습니다.")
        }finally{
            setLoading(false)
        }
    }

    async function updateBoard(boardId: string, updates: Partial<Board>) {
        try{
            const updateBoard = await boardService.updateBoard(
                supabase!,
                boardId,
                updates
            )
            setBoard(updateBoard)
            return updateBoard

        }catch(err){
            setError(err instanceof Error ? err.message : "보드 업데이트에 실패했습니다.")
        }
    }

    async function createRealTask(
        columnId: string,
        taskData:{
            title: string;
            description?: string;
            assignee?: string;
            dueDate?: string;
            priority?: "low" | "medium" | "high"
        }
    ) {
        try{
            const newTask = await taskService.createTask(supabase!, {
                title: taskData.title,
                description: taskData.description || null,
                assignee: taskData.assignee || null,
                due_date: taskData.dueDate || null,
                column_id: columnId,
                sort_order: columns.find(col => col.id === columnId)?.tasks.length || 0,
                priority: taskData.priority || "medium"
            })

            setColumns((prev)=> prev.map((col) => col.id === columnId ? {...col, tasks: [...col.tasks, newTask]} : col))

            return newTask
        }catch(err){
            setError(
                err instanceof Error ? err.message : "태스크 생성에 실패했습니다."
            )
        }
    }

    return{
        board,
        columns,
        loading,
        error,
        updateBoard,
        createRealTask
    }
}