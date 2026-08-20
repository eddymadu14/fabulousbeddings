
So the form becomes:
{formError && (
  <p
    role="alert"
    className="text-sm text-destructive"
  >
    {formError}
  </p>
)}

<button
  type="submit"
  disabled={isSubmitting}
  className="bg-primary px-6 py-4 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:self-start"
>
  {isSubmitting
    ? 'Processing...'
    : 'Continue'}
  
  <ArrowRight className="ml-2 inline size-4" />
</button>


