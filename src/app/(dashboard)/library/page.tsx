'use client'

import { useState } from 'react'
import AcademicHeader from '../../../components/academics/AcademicHeader'

type Book = {
  isbn: string
  title: string
  author: string
  subject: string
  copies: number
  status: 'Available' | 'Low Stock' | 'Out of Stock'
}

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [books] = useState<Book[]>([
    { isbn: '978-0134685991', title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', subject: 'Computer Science', copies: 8, status: 'Available' },
    { isbn: '978-0590353427', title: "Harry Potter and the Sorcerer's Stone", author: 'J.K. Rowling', subject: 'Fiction', copies: 3, status: 'Available' },
    { isbn: '978-0449012499', title: 'The Rise and Fall of the Third Reich', author: 'William L. Shirer', subject: 'History', copies: 1, status: 'Low Stock' },
    { isbn: '978-0060935467', title: 'To Kill a Mockingbird', author: 'Harper Lee', subject: 'English Literature', copies: 0, status: 'Out of Stock' },
    { isbn: '978-0321356680', title: 'Effective Java', author: 'Joshua Bloch', subject: 'Computer Science', copies: 5, status: 'Available' },
    { isbn: '978-0198520115', title: 'Oxford Dictionary of Physics', author: 'Richard Rennie', subject: 'Science', copies: 12, status: 'Available' }
  ])

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.isbn.includes(searchQuery)
  )

  return (
    <div className="space-y-6">
      <AcademicHeader 
        title="Library Catalog"
        description="Search textbooks, novels, reference manuals, and track active student book checkouts."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Library' }
        ]}
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm text-left">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Catalog Size</span>
          <h3 className="text-xl font-black text-slate-800 mt-1">2,450 Books</h3>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm text-left">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Active Checkouts</span>
          <h3 className="text-xl font-black text-indigo-600 mt-1">142 Books</h3>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm text-left">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Overdue Returns</span>
          <h3 className="text-xl font-black text-rose-600 mt-1">8 Books</h3>
        </div>
      </div>

      {/* Search Catalog */}
      <div className="w-full max-w-md bg-white border border-slate-200/60 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition">
        <span className="text-slate-400">🔍</span>
        <input
          type="text"
          placeholder="Search by title, author, or ISBN..."
          className="bg-transparent border-none outline-none text-xs text-slate-800 w-full placeholder-slate-400 focus:outline-none"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden text-left">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-4">ISBN</th>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Author</th>
              <th className="px-6 py-4">Subject</th>
              <th className="px-6 py-4 text-center">Copies</th>
              <th className="px-6 py-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
            {filteredBooks.map((b, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition">
                <td className="px-6 py-4 text-slate-400">{b.isbn}</td>
                <td className="px-6 py-4 text-slate-900 font-bold">{b.title}</td>
                <td className="px-6 py-4">{b.author}</td>
                <td className="px-6 py-4 text-slate-500">{b.subject}</td>
                <td className="px-6 py-4 text-center">{b.copies}</td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border ${
                    b.status === 'Available' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    b.status === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    'bg-rose-50 text-rose-700 border-rose-100'
                  }`}>
                    {b.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
