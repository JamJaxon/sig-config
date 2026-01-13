import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import Mustache from 'mustache';
import './App.css';

type TemplateOption = {
  slug: string;
  displayName: string;
  fileName: string;
};

type TemplateListResponse = {
  templates: TemplateOption[];
};

type TemplateDetailResponse = {
  slug: string;
  displayName: string;
  content: string;
  config?: {
    copyHtmlButton?: boolean;
    instructionsUrl?: string;
    [key: string]: unknown;
  };
};

type FormValues = Record<string, string>;

const TEMPLATE_LIST_ENDPOINT = '/.netlify/functions/list-templates';
const TEMPLATE_DETAIL_ENDPOINT = '/.netlify/functions/get-template';

type MustacheToken = [string, string, number, number, MustacheToken[]?, number?];

const extractTemplateVariables = (template: string): string[] => {
  const tokens = Mustache.parse(template) as MustacheToken[];
  const seen = new Set<string>();
  const variables: string[] = [];

  const addVariable = (name: string) => {
    if (!seen.has(name)) {
      seen.add(name);
      variables.push(name);
    }
  };

  const walk = (tokenList: MustacheToken[]) => {
    for (const token of tokenList) {
      const [type, value, , , children] = token;
      if ((type === 'name' || type === '&') && value) {
        addVariable(value);
      }

      if ((type === '#' || type === '^') && Array.isArray(children)) {
        walk(children);
      }
    }
  };

  walk(tokens);

  return variables;
};

const formatFieldLabel = (variable: string): string => {
  if (variable.includes('-') || variable.includes('_')) {
    return variable
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  if (/[a-z][A-Z]/.test(variable)) {
    return variable
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  return variable.replace(/^\w/, (char) => char.toUpperCase());
};

const App = () => {
  const { isLoading, isAuthenticated, error, loginWithRedirect, logout } = useAuth0();
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateListError, setTemplateListError] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [selectedSlug, setSelectedSlug] = useState('');
  const [templateDetail, setTemplateDetail] = useState<TemplateDetailResponse | null>(null);
  const [templateDetailError, setTemplateDetailError] = useState<string | null>(null);
  const [loadingTemplateDetail, setLoadingTemplateDetail] = useState(false);

  const [variables, setVariables] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const fetchTemplateDetail = useCallback(
    async (slug: string) => {
      if (!slug) {
        return;
      }

      setLoadingTemplateDetail(true);
      setTemplateDetailError(null);
      setCopyState('idle');

      try {
        const response = await fetch(`${TEMPLATE_DETAIL_ENDPOINT}?slug=${encodeURIComponent(slug)}`);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = (await response.json()) as TemplateDetailResponse;
        setTemplateDetail(data);

        const extractedVariables = extractTemplateVariables(data.content);
        setVariables(extractedVariables);

        const initialValues = extractedVariables.reduce<FormValues>((acc, variable) => {
          acc[variable] = '';
          return acc;
        }, {});

        setFormValues(initialValues);
      } catch (error) {
        console.error('Failed to load template', error);
        setTemplateDetail(null);
        setVariables([]);
        setFormValues({});
        setTemplateDetailError('Unable to load template. Please try again.');
      } finally {
        setLoadingTemplateDetail(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      setLoadingTemplates(true);
      setTemplateListError(null);
      try {
        const response = await fetch(TEMPLATE_LIST_ENDPOINT);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = (await response.json()) as TemplateListResponse;
        if (cancelled) {
          return;
        }

        setTemplates(data.templates);

        if (data.templates.length === 1) {
          const [singleTemplate] = data.templates;
          setSelectedSlug(singleTemplate.slug);
          await fetchTemplateDetail(singleTemplate.slug);
        } else if (data.templates.length > 1) {
          setSelectedSlug(data.templates[0]?.slug ?? '');
          setTemplateDetail(null);
          setVariables([]);
          setFormValues({});
        } else {
          setSelectedSlug('');
          setTemplateDetail(null);
          setVariables([]);
          setFormValues({});
        }
      } catch (error) {
        console.error('Failed to load template list', error);
        setTemplateListError('Unable to load templates. Please try again.');
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [fetchTemplateDetail]);

  const renderedPreview = useMemo(() => {
    if (!templateDetail) {
      return '';
    }
    try {
      return Mustache.render(templateDetail.content, formValues);
    } catch (error) {
      console.error('Failed to render template', error);
      return '';
    }
  }, [templateDetail, formValues]);

  const handleFieldChange = (field: string, value: string) => {
    setCopyState('idle');
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLoadTemplate = () => {
    void fetchTemplateDetail(selectedSlug);
  };

  const handleCopy = async () => {
    if (!renderedPreview) {
      return;
    }

    try {
      await navigator.clipboard.writeText(renderedPreview);
      setCopyState('copied');
    } catch (error) {
      console.error('Failed to copy template', error);
      setCopyState('error');
    }
  };

  const showCopyButton = templateDetail?.config?.copyHtmlButton ?? true;
  const instructionsUrl = templateDetail?.config?.instructionsUrl;

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Oops... {error.message}</div>;
  }

  if (isAuthenticated) {
    return (
      <div className="app-shell">
        <header className="top-bar">
          <div className="logo">
            <img src="/sigfig-logo.svg" alt="Sig Fig logo" />
          </div>
          <div>
            {instructionsUrl ? (
              <a href={instructionsUrl} target="_blank" rel="noreferrer" className="instructions-link">
                Read Instructions
              </a>
            ) : null}
            <button className="logout-link" onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
              Log out
            </button>
          </div>
        </header>

        <div className="app-container">
        <header className="app-header">
          <h1>Email Signature Builder</h1>
          <p>Choose a template, fill in your details, and copy the rendered signature.</p>
        </header>

        <section className="template-controls">
          {loadingTemplates ? (
            <p className="hint">Loading templates…</p>
          ) : templates.length > 1 ? (
            <>
              <label htmlFor="template-select" className="visually-hidden">
                Select template
              </label>
              <select
                id="template-select"
                value={selectedSlug}
                onChange={(event) => setSelectedSlug(event.target.value)}
                disabled={templates.length === 0}
              >
                {templates.map((template) => (
                  <option key={template.slug} value={template.slug}>
                    {template.displayName}
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleLoadTemplate} disabled={!selectedSlug || loadingTemplateDetail}>
                {loadingTemplateDetail ? 'Loading…' : 'Load'}
              </button>
            </>
          ) : templates.length === 1 ? (
            <div className="single-template-banner">
              Using template: <strong>{templates[0]?.displayName}</strong>
        </div>
          ) : (
            <div className="single-template-banner">No templates available.</div>
          )}
        </section>

        {templateListError ? <div className="error-banner">{templateListError}</div> : null}
        {templateDetailError ? <div className="error-banner">{templateDetailError}</div> : null}

        <main className="content">
          <section className="form-pane">
            <h2>Template Fields</h2>
            {loadingTemplateDetail && <p className="hint">Loading template…</p>}
            {!loadingTemplateDetail && variables.length === 0 && (
              <p className="hint">Select a template and click Load to begin.</p>
            )}
            <form className="field-grid">
              {variables.map((variable) => (
                <label key={variable} className="field">
                  <span className="field-label">{formatFieldLabel(variable)}</span>
                  <input
                    type="text"
                    value={formValues[variable] ?? ''}
                    onChange={(event) => handleFieldChange(variable, event.target.value)}
                    placeholder={formatFieldLabel(variable)}
                  />
                </label>
              ))}
            </form>
          </section>

          <section className="preview-pane">
            <div className="preview-header">
              <h2>Live Preview</h2>
              {showCopyButton ? (
                <button type="button" onClick={handleCopy} disabled={!renderedPreview}>
                  {copyState === 'copied' ? 'Copied!' : 'Copy HTML'}
          </button>
              ) : null}
            </div>
            {renderedPreview ? (
              <p className="hint gmail-note">
                Gmail users: select the preview area manually and copy to preserve formatting.
              </p>
            ) : null}
            {copyState === 'error' ? <p className="error-banner">Unable to copy. Please try again.</p> : null}
            <div className="preview-output">
              {renderedPreview ? (
                <div dangerouslySetInnerHTML={{ __html: renderedPreview }} />
              ) : (
                <p className="hint">Fill in the fields to see your signature.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
    );
  } else {
    return (
      <div className='login'>
        <img src="/sigfig-logo.svg" alt="Sig Fig logo" />
        <button className="login-link" onClick={() => loginWithRedirect()}>Log in</button>
      </div>
    );
  }
};

export default App;
