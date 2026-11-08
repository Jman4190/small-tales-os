'use client';

import { useState } from 'react';
import RegeneratePdfButton from './RegeneratePdfButton';
import ResendApprovalButton from './ResendApprovalButton';
import AdminApproveButton from './AdminApproveButton';
import { useToast } from '@/hooks/use-toast';

interface AdminWorkflowProps {
  bookId: string;
  orderId: string | null;
}

export default function AdminWorkflow({ bookId, orderId }: AdminWorkflowProps) {
  const [step1Complete, setStep1Complete] = useState(false);
  const { toast } = useToast();

  const handlePdfRegenerated = () => {
    setStep1Complete(true);
    toast({
      title: "✅ PDF Regeneration Complete",
      description: "The new production PDF has been successfully generated and is ready for approval.",
      variant: "default",
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-6 text-gray-800">Admin Workflow</h2>
      
      {/* Step 1: Regenerate PDF */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-bold mr-3 ${
            step1Complete ? 'bg-green-500' : 'bg-blue-500'
          }`}>
            {step1Complete ? '✓' : '1'}
          </div>
          <h3 className="text-lg font-semibold text-gray-800">
            Regenerate Production PDF
          </h3>
        </div>
        
        <div className="ml-11">
          <p className="text-sm text-gray-600 mb-4">
            First, regenerate the PDF with any image changes you've made. This creates a new production-ready PDF.
          </p>
          <RegeneratePdfButton 
            bookId={bookId} 
            orderId={orderId}
            onPdfRegenerated={handlePdfRegenerated}
          />
        </div>
      </div>

      {/* Step 2: Choose Action */}
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-bold mr-3 ${
            step1Complete ? 'bg-blue-500' : 'bg-gray-400'
          }`}>
            2
          </div>
          <h3 className={`text-lg font-semibold ${step1Complete ? 'text-gray-800' : 'text-gray-400'}`}>
            Choose Your Next Action
          </h3>
        </div>
        
        <div className="ml-11">
          <p className={`text-sm mb-4 ${step1Complete ? 'text-gray-600' : 'text-gray-400'}`}>
            After the PDF is regenerated, choose how to proceed:
          </p>
          
          {!step1Complete && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-500 text-center italic">
                Complete Step 1 first to unlock these options
              </p>
            </div>
          )}
          
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!step1Complete ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Option A: Send for Approval Again */}
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h4 className="font-semibold text-blue-800 mb-2">Option A: Customer Review</h4>
              <p className="text-sm text-blue-700 mb-3">
                Send the updated PDF to the customer for approval. Use this if you want the customer to review and approve the changes.
              </p>
              <ResendApprovalButton bookId={bookId} orderId={orderId} />
            </div>
            
            {/* Option B: Admin Approve & Print */}
            <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
              <h4 className="font-semibold text-orange-800 mb-2">Option B: Direct to Print</h4>
              <p className="text-sm text-orange-700 mb-3">
                Skip customer approval and send directly to print. Use this if you're confident the changes are correct and don't need customer review.
              </p>
              <AdminApproveButton bookId={bookId} orderId={orderId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}