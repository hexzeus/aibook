import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Clock, HardDrive, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { exportsApi } from '../lib/api';

function formatBytes(bytes?: number): string {
  if (!bytes) return 'N/A';
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`;
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function getFormatColor(format: string): string {
  switch (format.toLowerCase()) {
    case 'epub':
      return 'text-brand-400 bg-brand-500/20';
    case 'pdf':
      return 'text-red-400 bg-red-500/20';
    case 'docx':
      return 'text-blue-400 bg-blue-500/20';
    case 'mobi':
      return 'text-accent-purple bg-purple-500/20';
    default:
      return 'text-gray-400 bg-gray-500/20';
  }
}

export default function ExportHistory() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['exports', 'history'],
    queryFn: () => exportsApi.getHistory(100, 0),
  });

  const exports = data?.exports || [];

  return (
    <Layout>
      <div className="page-container">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2">Export History</h1>
          <p className="text-gray-400 text-lg">
            View all your exported books and download history
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-white/5 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : exports.length === 0 ? (
          <div className="card text-center py-16">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No exports yet</h3>
            <p className="text-gray-400 mb-6">
              Export your first book to see it here
            </p>
            <button
              onClick={() => navigate('/library')}
              className="btn-primary"
            >
              Go to Library
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {exports.map((exportRecord) => (
              <div
                key={exportRecord.export_id}
                className="card hover:shadow-glow transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg truncate group-hover:text-brand-400 transition-colors">
                        {exportRecord.book_title}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${getFormatColor(exportRecord.format)}`}>
                        {exportRecord.format}
                      </span>
                      {exportRecord.export_status === 'completed' && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                          Completed
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span>Exported {formatDate(exportRecord.created_at)}</span>
                      </div>

                      {exportRecord.file_size_bytes && (
                        <div className="flex items-center gap-1.5">
                          <HardDrive className="w-4 h-4" />
                          <span>{formatBytes(exportRecord.file_size_bytes)}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        <Download className="w-4 h-4" />
                        <span>{exportRecord.download_count} download{exportRecord.download_count !== 1 ? 's' : ''}</span>
                      </div>

                      {exportRecord.last_downloaded_at && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-gray-500">Last download: {formatDate(exportRecord.last_downloaded_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/book/${exportRecord.book_id}`)}
                      className="p-2 hover:bg-brand-500/20 rounded-lg transition-all"
                      title="View Book"
                    >
                      <Eye className="w-5 h-5 text-brand-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {exports.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-500">
            Showing {exports.length} export{exports.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </Layout>
  );
}
