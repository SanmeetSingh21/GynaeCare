import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Save, Package, Search, Info } from 'lucide-react'
import { Card } from '@components/ui/Card'
import Button from '@components/ui/Button'
import Select from '@components/ui/Select'
import Badge from '@components/ui/Badge'
import { SERVICE_CATALOG, PACKAGES, PAYMENT_METHODS } from './billingData'
import styles from './InvoiceNew.module.css'

const fmt    = n => `₹${Number(n).toLocaleString('en-IN')}`
const CATS   = ['All', ...new Set(SERVICE_CATALOG.map(s => s.category))]
const DISC_PRESETS = [5, 10, 15]

const FOLLOWUP_SERVICE_IDS = ['S002'] // "Follow-up Consultation" service ID

const MOCK_PATIENTS = [
  { id:'P001', name:'Priya Sharma', phone:'9876543210', lastVisit:'2026-03-10', lastVisitType:'OPD Consultation' },
  { id:'P002', name:'Anita Gupta',  phone:'9845012345', lastVisit:'2026-03-09', lastVisitType:'Fertility Cycle'  },
  { id:'P003', name:'Sunita Rao',   phone:'9712345678', lastVisit:'2026-03-07', lastVisitType:'OPD Consultation' },
  { id:'P004', name:'Kavya Menon',  phone:'9654321098', lastVisit:'2026-03-06', lastVisitType:'Ultrasound Study' },
  { id:'P005', name:'Reena Singh',  phone:'9532109876', lastVisit:'2026-03-05', lastVisitType:'OPD Consultation' },
  { id:'P006', name:'Lakshmi Iyer', phone:'9481234567', lastVisit:'2026-02-20', lastVisitType:'OPD Consultation' },
]

function daysBetween(dateStr) {
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24))
}

export default function InvoiceNew() {
  const navigate = useNavigate()

  // Patient
  const [patientSearch, setPatientSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [patient,       setPatient]       = useState(null)
  const [isFollowUp,    setIsFollowUp]    = useState(false) // within 5 days of OPD

  // Items
  const [items,     setItems]     = useState([])
  const [catFilter, setCatFilter] = useState('All')
  const [showPkgs,  setShowPkgs]  = useState(false)

  // Payment
  const [discPct,     setDiscPct]     = useState(null)   // 5 / 10 / 15 / null
  const [paymentPlan, setPaymentPlan] = useState('upfront') // 'upfront' | 'partial' | 'session'
  const [payMethod,   setPayMethod]   = useState('Cash')
  const [notes,       setNotes]       = useState('')

  // ── Patient search ──
  useEffect(() => {
    const q = patientSearch.trim().toLowerCase()
    if (q.length < 2) { setSearchResults([]); return }
    setSearchResults(MOCK_PATIENTS.filter(p =>
      p.name.toLowerCase().includes(q) || p.phone.includes(q)
    ))
  }, [patientSearch])

  const selectPatient = p => {
    setPatient(p)
    setSearchResults([])
    setPatientSearch('')
    setIsFollowUp(p.lastVisitType === 'OPD Consultation' && daysBetween(p.lastVisit) <= 5)
  }

  // ── Item helpers ──
  const addService = svc => {
    const ex = items.find(i => i.id === svc.id)
    if (ex) setItems(items.map(i => i.id === svc.id ? { ...i, qty: i.qty + 1 } : i))
    else    setItems([...items, { ...svc, qty: 1, type: 'service' }])
  }

  const addPackage = pkg => {
    setItems([...items, {
      id: pkg.id, name: pkg.name, category: 'Package',
      rate: pkg.price, qty: 1, type: 'package',
      sessions: pkg.includes.length, includes: pkg.includes
    }])
    setShowPkgs(false)
  }

  const updateQty  = (id, qty) => setItems(items.map(i => i.id === id ? { ...i, qty: Math.max(1, qty) } : i))
  const removeItem = id => setItems(items.filter(i => i.id !== id))

  // ── Is follow-up consultation item? ──
  const isFollowUpItem = item =>
    isFollowUp && FOLLOWUP_SERVICE_IDS.includes(item.id)

  // ── Totals ──
  const subtotal = useMemo(() =>
    items.reduce((s, i) => s + (isFollowUpItem(i) ? 0 : i.rate * i.qty), 0),
  [items, isFollowUp])

  const discAmt = useMemo(() =>
    discPct ? Math.round(subtotal * discPct / 100) : 0,
  [subtotal, discPct])

  const total = Math.max(0, subtotal - discAmt)

  // ── Payment plan eligibility ──
  const hasMultiSession = items.some(i => i.type === 'package' || (i.sessions && i.sessions > 1))
  const eligiblePartial = total >= 5000
  const sessionCount    = items.find(i => i.sessions)?.sessions || 1
  const perSessionAmt   = hasMultiSession ? Math.ceil(total / sessionCount) : 0

  // Reset plan if no longer eligible
  useEffect(() => {
    if (paymentPlan === 'partial'  && !eligiblePartial) setPaymentPlan('upfront')
    if (paymentPlan === 'session'  && !hasMultiSession) setPaymentPlan('upfront')
  }, [total, eligiblePartial, hasMultiSession])

  const filteredServices = catFilter === 'All'
    ? SERVICE_CATALOG
    : SERVICE_CATALOG.filter(s => s.category === catFilter)

  return (
    <div className="page-container">
      <button className={styles.backBtn} onClick={() => navigate('/billing')}>
        <ArrowLeft size={16}/> Back to Billing
      </button>

      <div className={styles.layout}>

        {/* ── LEFT: service catalog ── */}
        <div className={styles.left}>
          <Card padding="md">
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>Add Services</h3>
              <Button variant="outline" icon={Package} size="sm" onClick={() => setShowPkgs(s => !s)}>
                Packages
              </Button>
            </div>

            {showPkgs && (
              <div className={styles.pkgList}>
                {PACKAGES.map(p => (
                  <div key={p.id} className={styles.pkgCard}>
                    <div>
                      <div className={styles.pkgName}>{p.name}</div>
                      <div className={styles.pkgIncludes}>{p.includes.join(' · ')}</div>
                    </div>
                    <div className={styles.pkgRight}>
                      <span className={styles.pkgPrice}>{fmt(p.price)}</span>
                      <Button size="sm" onClick={() => addPackage(p)}>Add</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.catFilters}>
              {CATS.map(c => (
                <button key={c}
                  className={`${styles.catBtn} ${catFilter === c ? styles.catActive : ''}`}
                  onClick={() => setCatFilter(c)}>{c}
                </button>
              ))}
            </div>

            <div className={styles.serviceGrid}>
              {filteredServices.map(svc => {
                const isFree = isFollowUp && FOLLOWUP_SERVICE_IDS.includes(svc.id)
                return (
                  <button key={svc.id}
                    className={`${styles.svcCard} ${isFree ? styles.svcFree : ''}`}
                    onClick={() => addService(svc)}>
                    <div className={styles.svcName}>{svc.name}</div>
                    <div className={styles.svcRate}>
                      {isFree
                        ? <span className={styles.freeTag}>FREE (follow-up)</span>
                        : fmt(svc.rate)
                      }
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ── RIGHT: invoice panel ── */}
        <div className={styles.right}>

          {/* Patient */}
          <Card padding="md">
            <h3 className={styles.cardTitle}>Patient</h3>

            {!patient ? (
              <div className={styles.searchBox}>
                <div className={styles.searchWrap}>
                  <Search size={15} className={styles.searchIcon}/>
                  <input className={styles.searchInput}
                    placeholder="Search by name or phone..."
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    autoComplete="off"/>
                </div>
                {searchResults.length > 0 && (
                  <div className={styles.dropdown}>
                    {searchResults.map(p => {
                      const fu = p.lastVisitType === 'OPD Consultation' && daysBetween(p.lastVisit) <= 5
                      return (
                        <button key={p.id} className={styles.dropResult} onClick={() => selectPatient(p)}>
                          <div className={styles.drAvatar}>{p.name.split(' ').map(n=>n[0]).join('')}</div>
                          <div className={styles.drInfo}>
                            <div className={styles.drName}>{p.name}</div>
                            <div className={styles.drMeta}>{p.id} · {p.phone}</div>
                            <div className={styles.drVisit}>Last: {p.lastVisit} · {p.lastVisitType}</div>
                          </div>
                          {fu && <Badge variant="success" size="sm">Follow-up eligible</Badge>}
                        </button>
                      )
                    })}
                  </div>
                )}
                {patientSearch.length >= 2 && searchResults.length === 0 && (
                  <p className={styles.noResults}>No patients found.</p>
                )}
              </div>
            ) : (
              <div className={styles.selectedPatient}>
                <div className={styles.spLeft}>
                  <div className={styles.spAvatar}>{patient.name.split(' ').map(n=>n[0]).join('')}</div>
                  <div>
                    <div className={styles.spName}>{patient.name}</div>
                    <div className={styles.spMeta}>{patient.id} · {patient.phone}</div>
                    <div className={styles.spVisit}>Last: {patient.lastVisit} · {patient.lastVisitType}</div>
                  </div>
                </div>
                <button className={styles.clearBtn} onClick={() => { setPatient(null); setIsFollowUp(false) }}>
                  <X size={14}/>
                </button>
              </div>
            )}

            {isFollowUp && (
              <div className={styles.followUpNote}>
                <Info size={13}/>
                Follow-up within 5 days — <strong>Follow-up Consultation service will be free.</strong> All other services are charged normally.
              </div>
            )}
          </Card>

          {/* Items */}
          <Card padding="md">
            <h3 className={styles.cardTitle}>Invoice Items</h3>
            {items.length === 0
              ? <p className={styles.emptyMsg}>← Select services from the left</p>
              : (
                <div className={styles.itemList}>
                  {items.map(item => {
                    const free = isFollowUpItem(item)
                    return (
                      <div key={item.id} className={styles.itemRow}>
                        <div className={styles.itemLeft}>
                          <span className={styles.itemName}>{item.name}</span>
                          <div className={styles.itemBadges}>
                            <Badge variant="default" size="sm">{item.category}</Badge>
                            {free && <Badge variant="success" size="sm">Free</Badge>}
                            {item.type === 'package' && <Badge variant="teal" size="sm">{item.sessions} sessions</Badge>}
                          </div>
                        </div>
                        <div className={styles.itemRight}>
                          {item.type !== 'package' && (
                            <div className={styles.qtyCtrl}>
                              <button className={styles.qtyBtn} onClick={() => updateQty(item.id, item.qty - 1)}>−</button>
                              <span className={styles.qtyNum}>{item.qty}</span>
                              <button className={styles.qtyBtn} onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                            </div>
                          )}
                          <span className={`${styles.itemAmt} ${free ? styles.freeAmt : ''}`}>
                            {free ? 'FREE' : fmt(item.rate * item.qty)}
                          </span>
                          <button className={styles.removeBtn} onClick={() => removeItem(item.id)}>
                            <X size={12}/>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </Card>

          {/* Payment Summary */}
          <Card padding="md">
            <h3 className={styles.cardTitle}>Payment Summary</h3>

            {/* Subtotal + discount */}
            <div className={styles.summaryBox}>
              <div className={styles.summaryLine}>
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>

              <div className={styles.discountLine}>
                <span>Discount</span>
                <div className={styles.discRight}>
                  <div className={styles.pctBtns}>
                    {DISC_PRESETS.map(p => (
                      <button key={p}
                        className={`${styles.pctBtn} ${discPct === p ? styles.pctOn : ''}`}
                        onClick={() => setDiscPct(discPct === p ? null : p)}>
                        {p}%
                      </button>
                    ))}
                  </div>
                  <span className={styles.discVal}>
                    {discPct ? `${discPct}% = − ${fmt(discAmt)}` : '—'}
                  </span>
                </div>
              </div>

              <div className={`${styles.summaryLine} ${styles.totalLine}`}>
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
            </div>

            {/* Payment plan */}
            {items.length > 0 && total > 0 && (
              <div className={styles.planSection}>
                <div className={styles.planLabel}>Payment Plan</div>

                <div className={styles.planOptions}>
                  {/* Upfront — always available */}
                  <button
                    className={`${styles.planBtn} ${paymentPlan === 'upfront' ? styles.planActive : ''}`}
                    onClick={() => setPaymentPlan('upfront')}>
                    <div className={styles.planBtnTitle}>Pay Upfront</div>
                    <div className={styles.planBtnSub}>Full amount today · {fmt(total)}</div>
                  </button>

                  {/* Partial — only if total ≥ ₹5,000 */}
                  <button
                    className={`${styles.planBtn} ${paymentPlan === 'partial' ? styles.planActive : ''} ${!eligiblePartial ? styles.planDisabled : ''}`}
                    onClick={() => eligiblePartial && setPaymentPlan('partial')}
                    title={!eligiblePartial ? 'Only available for bills above ₹5,000' : ''}>
                    <div className={styles.planBtnTitle}>
                      Partial Payment
                      {!eligiblePartial && <span className={styles.planLock}>Min ₹5,000</span>}
                    </div>
                    <div className={styles.planBtnSub}>50% now, balance later</div>
                  </button>

                  {/* Session-wise — only if package or multi-session */}
                  <button
                    className={`${styles.planBtn} ${paymentPlan === 'session' ? styles.planActive : ''} ${!hasMultiSession ? styles.planDisabled : ''}`}
                    onClick={() => hasMultiSession && setPaymentPlan('session')}
                    title={!hasMultiSession ? 'Only available for packages or multi-session procedures' : ''}>
                    <div className={styles.planBtnTitle}>
                      Session-wise
                      {!hasMultiSession && <span className={styles.planLock}>Packages only</span>}
                    </div>
                    <div className={styles.planBtnSub}>
                      {hasMultiSession ? `${fmt(perSessionAmt)} × ${sessionCount} sessions` : 'Per session billing'}
                    </div>
                  </button>
                </div>

                {/* Plan breakdown */}
                {paymentPlan === 'partial' && eligiblePartial && (
                  <div className={styles.planBreakdown}>
                    <div className={styles.breakdownRow}>
                      <span>Due today (50%)</span>
                      <strong>{fmt(Math.ceil(total / 2))}</strong>
                    </div>
                    <div className={styles.breakdownRow}>
                      <span>Balance (due later)</span>
                      <strong>{fmt(Math.floor(total / 2))}</strong>
                    </div>
                  </div>
                )}

                {paymentPlan === 'session' && hasMultiSession && (
                  <div className={styles.planBreakdown}>
                    <div className={styles.breakdownRow}>
                      <span>Per session charge</span>
                      <strong>{fmt(perSessionAmt)}</strong>
                    </div>
                    <div className={styles.breakdownRow}>
                      <span>Total sessions</span>
                      <strong>{sessionCount}</strong>
                    </div>
                    <div className={styles.breakdownRow}>
                      <span>Due today (session 1)</span>
                      <strong>{fmt(perSessionAmt)}</strong>
                    </div>
                  </div>
                )}

                {paymentPlan === 'upfront' && (
                  <div className={styles.planBreakdown}>
                    <div className={styles.breakdownRow}>
                      <span>Amount due today</span>
                      <strong>{fmt(total)}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment method */}
            {items.length > 0 && total > 0 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Select label="Payment Method" value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  options={PAYMENT_METHODS}/>
              </div>
            )}

            {/* Notes */}
            <div style={{ marginTop: 'var(--space-4)' }}>
              <label className={styles.notesLabel}>Notes</label>
              <textarea className={styles.textarea} rows={2}
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Remarks, insurance details..."/>
            </div>

            <div className={styles.footer}>
              <Button variant="secondary" onClick={() => navigate('/billing')}>Cancel</Button>
              <Button icon={Save}
                disabled={!patient || items.length === 0}
                onClick={() => { alert('Invoice saved!'); navigate('/billing') }}>
                Save Invoice
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}