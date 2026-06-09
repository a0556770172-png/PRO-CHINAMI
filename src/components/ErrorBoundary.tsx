import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'משהו השתבש. אנא נסה לרענן את הדף.';
      let errorDetail = this.state.error?.message || '';

      // Try to parse JSON error from handleFirestoreError
      try {
        if (errorDetail.startsWith('{')) {
          const parsed = JSON.parse(errorDetail);
          if (parsed.error && parsed.error.includes('insufficient permissions')) {
            errorMessage = 'שגיאת הרשאות: אין לך הרשאה לבצע פעולה זו. ייתכן שצריך לעדכן את חוקי האבטחה.';
          }
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 dir-rtl">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-4">{errorMessage}</h1>
            <p className="text-slate-500 mb-8 text-sm">
              {errorDetail.length > 100 ? errorDetail.substring(0, 100) + '...' : errorDetail}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all"
            >
              <RefreshCcw className="h-5 w-5" />
              רענן דף
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
