import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext';
import { Activity, Search, PlusCircle, AlertTriangle, FileText, Trash2 } from 'lucide-react';
import { getPatients, deletePatient } from '../lib/storage';
import { format, differenceInHours } from 'date-fns';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function Home() {
    const { resetPatient } = usePatient();
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [showPatients, setShowPatients] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { currentUser } = useAuth();
    const [pushEnabled, setPushEnabled] = useState(Notification.permission === 'granted');

    useEffect(() => {
        loadPatients();
        checkAndSubscribePush();
    }, []);

    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const checkAndSubscribePush = async () => {
        if (!currentUser) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            const existingSubscription = await registration.pushManager.getSubscription();

            if (existingSubscription) {
                // Already subscribed, just ensure it's saved in DB
                await saveSubscriptionToDB(existingSubscription);
                setPushEnabled(true);
            }
        } catch (error) {
            console.error("Error checking push subscription:", error);
        }
    };

    const subscribeToPush = async () => {
        if (!currentUser) return;
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const registration = await navigator.serviceWorker.ready;
                const publicVapidKey = "BH2O-Az9MeKMLO8HFIGIM7PyBI45Wllp_TlUfnMxBHk19wU66pI7jP7ozsUFbONTVJOaMy4kh4SdZZ571r8GowQ"; // Replace with real VAPID public key
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                });

                await saveSubscriptionToDB(subscription);
                setPushEnabled(true);
                alert("Đã nhận cảnh báo 24h, cảm ơn Bác sĩ!");
            } else {
                alert("Bạn đã từ chối nhận thông báo. Hãy cho phép để sử dụng chức năng này.");
            }
        } catch (error) {
            console.error("Error subscribing to push:", error);
            alert("Trình duyệt thiết bị của bạn không thể nhận thông báo đẩy. (Gợi ý: Cài đặt PWA 'Thêm vào MH chính' trên thiết bị).");
        }
    };

    const saveSubscriptionToDB = async (subscription) => {
        try {
            await setDoc(doc(db, "subscriptions", currentUser.uid), {
                subscription: JSON.parse(JSON.stringify(subscription)),
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error saving to DB:", error);
        }
    };

    const loadPatients = async () => {
        const data = await getPatients();
        setPatients(data);
    };

    const handleDelete = async (id) => {
        if (confirm(`Bạn có chắc muốn xóa hồ sơ ${id}?`)) {
            await deletePatient(id);
            loadPatients();
        }
    };

    const getPriority = (p) => {
        if (p.evaluationResult) return 3; // Đã đánh giá xong -> Xếp dưới cùng
        const hours = differenceInHours(new Date(), new Date(p.createdAt));
        if (hours >= 24) return 1; // Quá 24h chưa đánh giá -> Xếp trên cùng (Màu đỏ)
        return 2; // Chưa quá 24h -> Ở giữa (Màu vàng)
    };

    const filteredPatients = patients.filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const dateStr = format(new Date(p.createdAt), 'dd/MM/yyyy');
        return p.id.toLowerCase().includes(q) || dateStr.includes(q);
    }).sort((a, b) => {
        const priorityA = getPriority(a);
        const priorityB = getPriority(b);
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        // Cùng mức ưu tiên thì xếp ca mới nhập viện lên trên
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="card glass-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1), transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img src="/logo.png" alt="Sổ tay NKSSS Online" style={{ width: '120px', height: '120px', marginBottom: '1.5rem', borderRadius: '50%', boxShadow: '0 10px 25px rgba(14, 165, 233, 0.4)' }} />
                <h1 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Sổ tay NKSSS Online</h1>
                <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto', fontSize: '1.1rem' }}>
                    Hướng dẫn đánh giá, chẩn đoán và lựa chọn kháng sinh Nhiễm khuẩn Sơ sinh sớm chuẩn mực y tế.
                </p>

                {!pushEnabled && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <button className="btn" style={{ padding: '0.5rem 1rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', border: '1px solid currentColor', borderRadius: 'var(--radius-md)' }} onClick={subscribeToPush}>
                            <Activity size={18} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                            Bật chuông Cảnh báo trên thiết bị này
                        </button>
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderTop: '4px solid var(--color-primary)' }}>
                    <div style={{ background: 'rgba(14, 165, 233, 0.1)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem', color: 'var(--color-primary)' }}>
                        <PlusCircle size={32} />
                    </div>
                    <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>Tiếp nhận bệnh nhân mới</h3>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', flex: 1 }}>Nhập ca bệnh lâm sàng mới, thực hiện bảng checklist đánh giá để phân độ mức cảnh báo.</p>
                    <Link to="/admission" className="btn btn-primary" style={{ width: '100%' }} onClick={resetPatient}>
                        Bắt đầu khám ngay
                    </Link>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderTop: '4px solid var(--color-secondary)' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem', color: 'var(--color-success)' }}>
                        <Search size={32} />
                    </div>
                    <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>Tra cứu & Theo dõi hồ sơ</h3>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', flex: 1 }}>Truy xuất những người bệnh trước đó, đánh giá thay đổi sau 18 - 24 tiếng dùng kháng sinh theo hệ thống nhắc nhở.</p>
                    <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => {
                        setShowPatients(prev => {
                            const next = !prev;
                            if (next) {
                                setTimeout(() => {
                                    document.getElementById('patient-list-section')?.scrollIntoView({ behavior: 'smooth' });
                                }, 100);
                            }
                            return next;
                        });
                    }}>
                        {showPatients ? 'Ẩn danh sách bệnh nhân' : 'Xem danh sách bệnh nhân'}
                    </button>
                </div>
            </div>

            {showPatients && (
                <div id="patient-list-section" className="card animate-slide-up" style={{ marginTop: '1rem' }}>
                    <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={24} color="var(--color-primary)" />
                        Danh sách bệnh nhân (Đang theo dõi)
                    </h2>

                    {patients.length > 0 && (
                        <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
                                <Search size={18} />
                            </div>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Tìm kiếm theo mã số bệnh nhân, ngày nhập viện..."
                                style={{ paddingLeft: '2.5rem' }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    )}

                    {filteredPatients.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem' }}>
                            {patients.length === 0 ? 'Chưa có bệnh nhân nào trên hệ thống.' : 'Không tìm thấy kết quả phù hợp.'}
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {filteredPatients.map(p => (
                                <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: p.evaluationResult ? '1px solid var(--color-border)' : (differenceInHours(new Date(), new Date(p.createdAt)) >= 24 ? '2px solid var(--color-danger)' : '1px solid var(--color-border)'), gap: '1rem' }}>
                                    <div style={{ flex: '1 1 min-content' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {p.id}
                                            {!p.evaluationResult && differenceInHours(new Date(), new Date(p.createdAt)) >= 24 && (
                                                <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--color-danger)', color: 'white', padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold', animation: 'pulse 2s infinite' }}>TỚI HẠN ĐÁNH GIÁ</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                                            {p.ageDays} ngày tuổi, {p.weight}g, Nhập viện: {format(new Date(p.createdAt), 'dd/MM/yyyy HH:mm')}
                                        </div>

                                        {p.evaluationResult && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', padding: '0.2rem 0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', borderRadius: '4px', display: 'inline-block' }}>
                                                Đã đánh giá: {p.evaluationResult}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {!p.evaluationResult ? (
                                            <button
                                                className="btn"
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    backgroundColor: differenceInHours(new Date(), new Date(p.createdAt)) >= 24 ? 'var(--color-danger)' : 'rgba(245, 158, 11, 0.1)',
                                                    color: differenceInHours(new Date(), new Date(p.createdAt)) >= 24 ? 'white' : 'var(--color-warning)'
                                                }}
                                                onClick={() => navigate(`/reevaluation/${p.id}`)}>
                                                <AlertTriangle size={18} style={{ marginRight: '0.25rem' }} />
                                                {differenceInHours(new Date(), new Date(p.createdAt)) >= 24 ? 'Đánh giá ngay' : `Chờ 24h (${differenceInHours(new Date(), new Date(p.createdAt))}h)`}
                                            </button>
                                        ) : (
                                            <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={() => navigate(`/reevaluation/${p.id}`)}>
                                                Sửa đánh giá
                                            </button>
                                        )}
                                        <button className="btn btn-secondary" style={{ padding: '0.5rem', color: 'var(--color-danger)' }} onClick={() => handleDelete(p.id)}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
