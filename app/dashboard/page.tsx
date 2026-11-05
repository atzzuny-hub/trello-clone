'use client'

import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { useBoards } from "@/lib/hooks/useBoards";
import { useUser } from "@clerk/nextjs";
import { Plus } from "lucide-react";

//https://probable-clam-9881.clerk.accounts.dev

export default function DashboardPage(){

    const {user} = useUser()
    const {createBoard} = useBoards()

    const handleCreateBoard = async () => {
        await createBoard({title: "New Board"})
    }

    return(
        <div className="min-h-screen bg-gray-50">
            <Navbar/>

            <main className="container mx-auto px-4 py-6 sm:py-8">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                        다시 오신 것을 환영합니다,{" "} 
                        {user?.firstName ?? user?.emailAddresses[0]?.emailAddress}! ✋
                    </h1>
                    <p className="text-gray-600">
                        오늘 귀사의 보드에서 어떤 일이 일어나고 있는지 알려드립니다.
                    </p>
                    <Button
                        className="w-full sm:w-auto"
                        onClick={handleCreateBoard}
                    >
                        <Plus className="h-4 w-4 mr-2"/>
                        create Board
                    </Button>
                </div>
            </main>
        </div>
    )
}