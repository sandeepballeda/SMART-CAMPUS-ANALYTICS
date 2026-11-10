CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  leave_type text NOT NULL DEFAULT 'Casual',
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT leave_dates_ok CHECK (end_date >= start_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave read" ON public.leave_requests FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'hod') AND department_id = public.my_dept()));
CREATE POLICY "leave insert" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND department_id = public.my_dept() AND status = 'pending');
CREATE POLICY "leave cancel own pending" ON public.leave_requests FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() AND status = 'pending');
CREATE POLICY "leave review" ON public.leave_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'hod') AND department_id = public.my_dept() AND teacher_id <> auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'hod') AND department_id = public.my_dept() AND teacher_id <> auth.uid()));