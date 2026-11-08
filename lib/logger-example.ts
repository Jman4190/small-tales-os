// Server-side example (API route or Server Component)
import { logBookEvent, flushLogs } from './book-logger';

export async function serverSideExample() {
  // Log a book event to both Supabase and BetterStack
  await logBookEvent(
    'book-123', 
    'Book viewed',
    { 
      user_id: 'user-456',
      page: 42,
      duration: 120
    }
  );
  
  // Make sure to flush logs before the server process terminates
  // This is important for serverless functions
  await flushLogs();
}

// Client-side example (React component)
// This would be in a .tsx file, shown here for reference
/*
import { useEffect } from 'react';
import { logInfo, logError, logWarning, flushClientLogs } from '../lib/client-logger';

export function ClientComponent() {
  useEffect(() => {
    // Log info when component mounts
    logInfo('Component mounted', { 
      component: 'ClientComponent',
      props: { id: 123 }
    });
    
    // Log warning
    logWarning('Low memory warning', { 
      availableMemory: '120MB'
    });
    
    // Example error logging
    try {
      // Some code that might throw
      throw new Error('Example error');
    } catch (error) {
      logError('Error in component', { 
        error: error instanceof Error ? error.message : String(error),
        component: 'ClientComponent'
      });
    }
    
    // Flush logs when component unmounts
    return () => {
      flushClientLogs();
    };
  }, []);
  
  return <div>Example Component</div>;
}
*/

// Universal logger example (works in both environments)
import { log, isClient } from './logger';

export function universalLoggerExample() {
  // This will work in both client and server environments
  log('info', 'Application started', { 
    environment: isClient ? 'client' : 'server',
    timestamp: new Date().toISOString()
  });
  
  // Error logging
  log('error', 'Something went wrong', {
    code: 500,
    details: 'Connection timeout'
  });
} 