"use client"

import { SignInButton, SignUpButton, useUser } from '@clerk/nextjs'
import { ArrowRight, SquareKanban } from 'lucide-react'
import { Button } from './ui/button'
import Link from 'next/link'

export default function Navbar(){

    const {isSignedIn, user} = useUser()

    return(
        <header className='border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50'>
            <div className='container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between'>
                <div className='flex items-center space-x-2'>
                    <SquareKanban className="size-6 sm:size-8 text-blue-600" />
                    <span className='text-xl sm:text-2xl font-bold text-gray-900'> Trello Clone</span>
                </div>

                <div className='flex items-center space-x-2 sm:space-x-4'>
                    
                    {isSignedIn 
                        ?<div className='flex flex-col sm:flex-row items-end sm:items-center space-y-1 sm:space-y-0 sm:space-x-4'>
                            <span className='text-xs sm:text-sm text-gray-600 hidden sm:block'>
                                Welcome, {user.firstName ?? user.emailAddresses[0]?.emailAddress}
                            </span>
                            <Button asChild size='sm' className='text-xs sm:text-sm'>
                                <Link href="/dashboard">
                                    Go to Dashboard <ArrowRight/>
                                </Link>
                            </Button>
                        </div>
                        :<div>
                            <SignInButton>
                                <Button variant="ghost" size='sm' className='text-xs sm:text-sm'>
                                    Sign in
                                </Button>
                            </SignInButton>
                            <SignUpButton>
                                <Button size='sm' className='text-xs sm:text-sm'>
                                    Sign Up
                                </Button>
                            </SignUpButton>
                        </div>
                    }
                    
                </div>
            </div>
        </header>
    )
}