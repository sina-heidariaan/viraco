'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogActions } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { ApiError, api, describeError, fieldErrors } from '@/lib/api-client';
import { ROLES, ROLE_LABELS } from '@/lib/labels';
import { USER_LIMITS, type CreateUserBody, type Role, type UpdateUserBody, type User } from '@/types/api';

type UserFormDialogProps = {
  open: boolean;
  /** null = create a new user. */
  user: User | null;
  /** Changes on every open, so the form starts fresh. */
  formKey: number;
  onClose: () => void;
  onSaved: (user: User, created: boolean) => void;
};

export function UserFormDialog({ open, user, formKey, onClose, onSaved }: UserFormDialogProps) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title={user ? 'ویرایش کاربر' : 'کاربر جدید'}
      description={user ? <bdi dir="ltr">{user.email}</bdi> : 'ایمیل و رمز عبور را بعداً نمی‌توان از اینجا تغییر داد.'}
    >
      <UserForm key={formKey} user={user} pending={pending} setPending={setPending} onCancel={onClose} onSaved={onSaved} />
    </Dialog>
  );
}

type Field = 'name' | 'email' | 'password' | 'role';

const fa = (n: number) => n.toLocaleString('fa-IR');

const SERVER_FIELD_MESSAGES: Record<Field, string> = {
  name: `نام را وارد کنید (حداکثر ${fa(USER_LIMITS.nameMax)} نویسه).`,
  email: 'یک ایمیل معتبر وارد کنید.',
  password: `رمز عبور باید ${fa(USER_LIMITS.passwordMin)} تا ${fa(USER_LIMITS.passwordMax)} نویسه باشد.`,
  role: 'یک نقش معتبر انتخاب کنید.',
};

const DUPLICATE_EMAIL = 'این ایمیل قبلاً برای کاربر دیگری ثبت شده است.';
const LAST_OWNER =
  'این کاربر آخرین مالک فعال است. نقش او را فقط وقتی می‌توانید تغییر دهید که مالک فعال دیگری وجود داشته باشد.';

type UserFormProps = {
  user: User | null;
  pending: boolean;
  setPending: (pending: boolean) => void;
  onCancel: () => void;
  onSaved: (user: User, created: boolean) => void;
};

function UserForm({ user, pending, setPending, onCancel, onSaved }: UserFormProps) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(user?.role ?? 'member');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function clearError(field: Field) {
    if (!errors[field]) return;
    setErrors((prev) => {
      const rest = { ...prev };
      delete rest[field];
      return rest;
    });
  }

  function showErrors(found: Partial<Record<Field, string>>): boolean {
    setErrors(found);
    const first = (['name', 'email', 'password'] as const).find((field) => found[field]);
    if (first) ({ name: nameRef, email: emailRef, password: passwordRef })[first].current?.focus();
    return Object.keys(found).length > 0;
  }

  function validate(): Partial<Record<Field, string>> {
    const found: Partial<Record<Field, string>> = {};
    const trimmed = name.trim();
    if (!trimmed) found.name = 'نام را وارد کنید.';
    else if (trimmed.length > USER_LIMITS.nameMax) found.name = SERVER_FIELD_MESSAGES.name;
    if (!user) {
      const mail = email.trim();
      // The backend checks the full format; this only catches the obvious mistakes early.
      if (!mail) found.email = 'ایمیل را وارد کنید.';
      else if (!/^[^\s@]+@[^\s@]+$/.test(mail) || mail.length > USER_LIMITS.emailMax) found.email = SERVER_FIELD_MESSAGES.email;
      if (password.length < USER_LIMITS.passwordMin || password.length > USER_LIMITS.passwordMax) {
        found.password = SERVER_FIELD_MESSAGES.password;
      }
    }
    return found;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    if (showErrors(validate())) return;

    let request: Promise<User>;
    if (user) {
      const body: UpdateUserBody = {};
      if (name.trim() !== user.name) body.name = name.trim();
      if (role !== user.role) body.role = role;
      if (Object.keys(body).length === 0) {
        onCancel(); // nothing changed
        return;
      }
      request = api<User>(`/users/${user.id}`, { method: 'PATCH', json: body });
    } else {
      const body: CreateUserBody = { name: name.trim(), email: email.trim(), password, role };
      request = api<User>('/users', { method: 'POST', json: body });
    }

    setPending(true);
    try {
      const saved = await request;
      setPending(false);
      onSaved(saved, !user);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.status === 409) {
        // 409: duplicate email (with a field detail) or the last-owner rule (AS8).
        if (err.details.some((detail) => detail.field === 'email')) showErrors({ email: DUPLICATE_EMAIL });
        else setFormError(LAST_OWNER);
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        setFormError('این کاربر پیدا نشد. صفحه را دوباره بارگذاری کنید.');
        return;
      }
      if (!showErrors(fieldErrors(err, SERVER_FIELD_MESSAGES))) setFormError(describeError(err));
    }
  }

  return (
    <form noValidate onSubmit={onSubmit}>
      <div role="alert">
        {formError && (
          <p className="mb-5 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800">
            {formError}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-5">
        <TextField
          ref={nameRef}
          label="نام"
          name="name"
          dir="auto"
          autoComplete="off"
          maxLength={USER_LIMITS.nameMax}
          value={name}
          error={errors.name}
          onChange={(event) => {
            setName(event.target.value);
            clearError('name');
          }}
        />
        {!user && (
          <>
            <TextField
              ref={emailRef}
              label="ایمیل"
              name="email"
              type="email"
              dir="ltr"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={USER_LIMITS.emailMax}
              value={email}
              error={errors.email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError('email');
              }}
            />
            <TextField
              ref={passwordRef}
              label="رمز عبور"
              name="password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              maxLength={USER_LIMITS.passwordMax}
              value={password}
              error={errors.password}
              hint={`${fa(USER_LIMITS.passwordMin)} تا ${fa(USER_LIMITS.passwordMax)} نویسه. آن را به کاربر بدهید.`}
              onChange={(event) => {
                setPassword(event.target.value);
                clearError('password');
              }}
            />
          </>
        )}
        <Select
          label="نقش"
          value={role}
          options={ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))}
          error={errors.role}
          onChange={(value) => {
            setRole(value);
            clearError('role');
          }}
        />
      </div>
      <DialogActions>
        <Button type="submit" disabled={pending}>
          {pending ? 'در حال ذخیره…' : user ? 'ذخیرهٔ تغییرات' : 'ساخت کاربر'}
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
          انصراف
        </Button>
      </DialogActions>
    </form>
  );
}
