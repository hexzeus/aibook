import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Edit, Loader2, BookOpen } from 'lucide-react';
import Layout from '../components/Layout';
import { booksApi } from '../lib/api';

export default function BookView() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => booksApi.getBook(bookId!),
    enabled: !!bookId,
  });

  const exportBookMutation = useMutation({
    mutationFn: (bookId: string) => booksApi.exportBook(bookId),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${book?.title}.epub`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
  });

  const book = data?.book;
  const pages = book?.pages || [];

  if (isLoading) {
    return (
      <Layout>
        <div className="page-container flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        </div>
      </Layout>
    );
  }

  if (!book) {
    return (
      <Layout>
        <div className="page-container">
          <div className="card text-center py-12">
            <p className="text-gray-400">Book not found</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container max-w-5xl">
        <div className="mb-6">
          <button
            onClick={() => navigate('/library')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </button>

          <div className="flex flex-col md:flex-row gap-8">
            {book.cover_svg && (
              <div className="w-full md:w-64 flex-shrink-0">
                <img
                  src={book.cover_svg}
                  alt={book.title}
                  className="w-full rounded-2xl shadow-2xl"
                />
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-4xl font-display font-bold mb-2">{book.title}</h1>
              {book.subtitle && (
                <p className="text-xl text-gray-400 mb-4">{book.subtitle}</p>
              )}
              <p className="text-gray-400 mb-6">{book.description}</p>

              <div className="flex items-center gap-4 mb-6 text-sm text-gray-400">
                <span>{pages.length} pages</span>
                <span>•</span>
                <span>{book.book_type}</span>
                <span>•</span>
                <span>Completed</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => exportBookMutation.mutate(book.book_id)}
                  disabled={exportBookMutation.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  {exportBookMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Download EPUB
                    </>
                  )}
                </button>
                <button
                  onClick={() => navigate(`/editor/${book.book_id}`)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Edit className="w-5 h-5" />
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-brand-400" />
            Preview
          </h2>

          <div className="space-y-8 max-h-[600px] overflow-y-auto pr-4 scrollbar-hide">
            {pages.map((page) => (
              <div key={page.page_id} className="pb-8 border-b border-white/10 last:border-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-brand-400 font-semibold">
                    Page {page.page_number}
                  </div>
                  <div className="text-sm text-gray-500">{page.section}</div>
                </div>
                <div className="prose prose-invert prose-lg max-w-none">
                  <div className="whitespace-pre-wrap font-serif text-base leading-relaxed">
                    {page.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
