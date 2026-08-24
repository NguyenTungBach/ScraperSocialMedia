'use client';

import React from 'react';
import { ToastContainer, cssTransition } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const FadeTransition = cssTransition({
  enter: 'awa-toast-fade-in',
  exit: 'awa-toast-fade-out',
  collapse: false,
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastContainer
        position="top-center"
        autoClose={3000}
        theme="light"
        transition={FadeTransition}
      />
    </>
  );
}
