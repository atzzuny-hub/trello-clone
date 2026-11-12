"use client"

import { useUser } from "@clerk/nextjs"
import { useEffect, useState } from "react";
import { Board, BoardWithTaskCount, Column, ColumnWithTasks, Task } from "../supabase/models";
import { boardDataService, boardService, columnService, taskService } from "../services";
import { useSupabase } from "../supabase/SupabaseProvider";




export function useBoards(){

    const {user} = useUser();
    const {supabase} = useSupabase()
    // const [boards, setBoards] = useState<Board[]>([])
    const [boards, setBoards] = useState<BoardWithTaskCount[]>([])
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
            // setBoards((prev) => [newBoard, ...prev])
            setBoards((prev) => [{...newBoard, taskCount: 0}, ...prev])
        }catch(err){
            setError(err instanceof Error ? err.message : "보드를 생성하지 못했습니다.")
        }
    }

    return {boards, loading, error, createBoard}
}

export function useBoard(boardId: string){
    const {user} = useUser()
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

    async function moveTask(
        taskId: string, 
        newColumnId: string, 
        newOrder:number
    ){
        try{
            await taskService.moveTask(supabase!, taskId, newColumnId, newOrder)
            
            setColumns((prev) => {
                const newColumns = [...prev]

                let taskToMove : Task | null = null;
                for(const col of newColumns) {
                    const taskIndex = col.tasks.findIndex((task) => task.id === taskId)
                    if(taskIndex !== -1){
                        taskToMove = col.tasks[taskIndex]
                        col.tasks.splice(taskIndex, 1)
                        break
                    }
                }

                if(taskToMove){
                    const targetColumn = newColumns.find((col) => col.id === newColumnId);

                    if(targetColumn){
                        targetColumn.tasks.splice(newOrder, 0, taskToMove)
                    }
                }
                return newColumns
            })
        }catch(err){
            setError(err instanceof Error ? err.message : "태스크 이동에 실패했습니다.")
        } 
    }

    async function  createColumn(title:string) {
        if(!board || !user) throw new Error("보드가 로드되지 않았습니다.")

        try{
            const newColumn = await columnService.createColumn(supabase!, {
                title, 
                board_id: board.id, 
                sort_order: columns.length,
                user_id: user?.id
            })

            setColumns((prev) => [...prev, {...newColumn, tasks: []}])
            return newColumn

        }catch(err){
            setError(err instanceof Error ? err.message : "열을 생성하지 못했습니다.")
        } 
    }

    async function updateColumn(columnId:string, title:string) {
        try{
            const updateColumn = await columnService.updateColumnTitle(supabase!, columnId, title)

            setColumns((prev) => prev.map((col) => col.id === columnId ? {...col, ...updateColumn} : col))
            return updateColumn
            
        }catch(err){
            setError(err instanceof Error ? err.message : "열의 이름을 바꾸지 못했습니다.")
        } 
    }

    return{
        board,
        columns,
        loading,
        error,
        updateBoard,
        createRealTask,
        setColumns,
        moveTask,
        createColumn,
        updateColumn
    }
}