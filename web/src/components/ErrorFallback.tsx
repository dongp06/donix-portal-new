import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export interface ErrorFallbackProps {
  title?: string;
  message?: string;
  cause?: Error | unknown;
  onRetry?: () => void;
  onGoHome?: () => void;
  showErrorDetails?: boolean;
  statusMessage?: string;
}

export function ErrorFallback({
  title = "Oops! Something went wrong",
  message = "We're aware of the issue and actively working to fix it. Your experience matters to us.",
  cause,
  onRetry,
  onGoHome,
  showErrorDetails = true,
  statusMessage = "Our team has been notified",
}: ErrorFallbackProps) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-rainbow opacity-5 dark:opacity-10" />

        <Card className="relative backdrop-blur-sm shadow-2xl">
          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold">{title}</h1>
              <p className="text-muted-foreground">{message}</p>
            </div>

            {statusMessage ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span>{statusMessage}</span>
              </div>
            ) : null}

            <div className="space-y-3">
              <Button onClick={handleRetry} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={handleGoHome} variant="secondary" className="w-full">
                <Home className="w-4 h-4 mr-2" />
                Go to Homepage
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && showErrorDetails && cause ? (
              <details className="mt-6 p-4 bg-muted/50 rounded-lg">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Error details (Development only)
                </summary>
                <pre className="mt-3 text-xs overflow-auto max-h-40 text-muted-foreground">
                  {cause instanceof Error
                    ? `${cause.message}${cause.stack ? '\n\n' + cause.stack : ''}`
                    : String(cause)}
                </pre>
              </details>
            ) : null}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          If this problem persists, please contact our support team
        </p>
      </div>
    </div>
  );
}
