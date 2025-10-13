"use client";
import React from "react";

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; msg?: string }
> {
  constructor(props:any){ super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(err:any){ return { hasError: true, msg: String(err) }; }
  componentDidCatch(err:any){ console.error(err); }
  render(){
    if (this.state.hasError) {
      return <div className="p-4 rounded-2xl border border-red-500/40 bg-red-500/10 text-red-200 text-sm">
        Something went wrong: {this.state.msg}
      </div>;
    }
    return this.props.children;
  }
}
