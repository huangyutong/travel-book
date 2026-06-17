import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ItineraryItem {
  time: string;
  type: 'spot' | 'restaurant' | 'hotel' | 'activity';
  name: string;
  address: string;
  duration?: number;
  notes?: string;
}

interface TravelDay {
  date: string;
  city: string;
  title: string;
  temperature: string;
  heroImage: string;
  itinerary: ItineraryItem[];
  notes: string[];
}

interface Member {
  id: string;
  name: string;
  color: string;
}

interface BudgetItem {
  id: string;
  category: 'transport' | 'food' | 'accommodation' | 'ticket' | 'other';
  name: string;
  amount: number;
  currency: string;
  notes?: string;
  paidBy?: string; // 付款人 ID
  splitWith?: string[]; // 參與分攤的成員 ID 列表
  splitType?: 'equal' | 'custom'; // 分攤方式：平均分攤或自訂
  customSplits?: { [memberId: string]: number }; // 自訂分攤金額
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

interface ExchangeRates {
  [key: string]: number;
}

@Component({
  selector: 'app-travel-guide',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './travel-guide.component.html',
  styleUrls: ['./travel-guide.component.css']
})
export class TravelGuideComponent implements OnInit {
  // 狀態變數
  currentDayIndex: number = 0;
  isDarkMode: boolean = false;
  tabStartIndex: number = 0;
  uploadedImages: { [key: number]: string } = {};
  showImageUpload: boolean = false;
  draggedItemIndex: number | null = null;
  showItineraryForm: boolean = false;
  editingIndex: number | null = null;
  
  itineraryForm: ItineraryItem = {
    time: '',
    type: 'spot',
    name: '',
    address: '',
    duration: 0,
    notes: ''
  };

  itineraries: { [key: number]: ItineraryItem[] } = {};

  // 預算管理相關
  currentView: 'itinerary' | 'budget' = 'itinerary';
  budgetItems: { [key: number]: BudgetItem[] } = {};
  showBudgetForm: boolean = false;
  editingBudgetId: string | null = null;
  
  budgetForm: BudgetItem = {
    id: '',
    category: 'food',
    name: '',
    amount: 0,
    currency: 'TWD',
    notes: '',
    paidBy: '',
    splitWith: [],
    splitType: 'equal',
    customSplits: {}
  };

  totalBudget: number = 100000;
  showBudgetSettings: boolean = false;
  baseCurrency: string = 'TWD';

  // 成員和分賬相關
  members: Member[] = [
    { id: '1', name: '小王', color: 'bg-blue-500' },
    { id: '2', name: '小李', color: 'bg-green-500' },
    { id: '3', name: '小陳', color: 'bg-purple-500' }
  ];
  showMemberForm: boolean = false;
  showSettlementView: boolean = false;
  memberForm: Member = {
    id: '',
    name: '',
    color: 'bg-blue-500'
  };
  editingMemberId: string | null = null;
  availableColors: string[] = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
    'bg-yellow-500', 'bg-red-500', 'bg-indigo-500', 'bg-teal-500'
  ];

  // 匯率資料
  exchangeRates: ExchangeRates = {
    TWD: 1,
    USD: 0.032,
    EUR: 0.029,
    JPY: 4.8,
    ISK: 4.4,
    CNY: 0.23
  };

  // 旅遊資料
  mockTravelData: TravelDay[] = [
    {
      date: '2026-02-22',
      city: '雷克雅維克',
      title: 'D1 - 抵達冰島',
      temperature: '2°C',
      heroImage: 'data:image/svg+xml,%3Csvg width="800" height="600" xmlns="http://www.w3.org/2000/svg"%3E%3Cdefs%3E%3ClinearGradient id="g1" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%236366f1" /%3E%3Cstop offset="100%25" style="stop-color:%23ec4899" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="800" height="600" fill="url(%23g1)" /%3E%3C/svg%3E',
      itinerary: [
        { time: '15:55', type: 'activity', name: '抵達機場', address: 'Keflavik Airport', duration: 60, notes: '取車' },
        { time: '17:00', type: 'spot', name: '彩虹街', address: 'Rainbow Street', duration: 30 },
        { time: '18:00', type: 'spot', name: 'Sun Voyager', address: 'Saebraut', duration: 15 },
        { time: '19:00', type: 'restaurant', name: 'Harpa 餐廳', address: 'Harpa Concert Hall' },
        { time: '21:00', type: 'hotel', name: 'Aurora Nooks', address: 'Reykjavik', notes: 'NT$ 10,637' }
      ],
      notes: ['小王已付款', '訂單 1677187010']
    },
    {
      date: '2026-02-23',
      city: '黃金圈',
      title: 'D2 - 黃金圈',
      temperature: '1°C',
      heroImage: 'data:image/svg+xml,%3Csvg width="800" height="600" xmlns="http://www.w3.org/2000/svg"%3E%3Cdefs%3E%3ClinearGradient id="g2" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%23f59e0b" /%3E%3Cstop offset="100%25" style="stop-color:%23dc2626" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="800" height="600" fill="url(%23g2)" /%3E%3C/svg%3E',
      itinerary: [
        { time: '09:00', type: 'spot', name: 'Thingvellir 國家公園', address: 'Thingvellir', duration: 120 },
        { time: '12:00', type: 'restaurant', name: '午餐', address: 'Thingvellir' },
        { time: '14:00', type: 'spot', name: 'Geysir 間歇泉', address: 'Haukadalur', duration: 30 },
        { time: '15:00', type: 'spot', name: 'Gullfoss 瀑布', address: 'Gullfoss', duration: 30 },
        { time: '18:00', type: 'hotel', name: 'Hotel South Coast', address: 'South Coast', notes: 'NT$ 9,247' }
      ],
      notes: ['小王已付款', '24小時櫃台']
    },
    {
      date: '2026-02-24',
      city: 'Vik',
      title: 'D3 - 南岸',
      temperature: '3°C',
      heroImage: 'data:image/svg+xml,%3Csvg width="800" height="600" xmlns="http://www.w3.org/2000/svg"%3E%3Cdefs%3E%3ClinearGradient id="g3" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%230ea5e9" /%3E%3Cstop offset="100%25" style="stop-color:%230891b2" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="800" height="600" fill="url(%23g3)" /%3E%3C/svg%3E',
      itinerary: [
        { time: '09:00', type: 'spot', name: 'Seljalandsfoss', address: 'Seljalandsfoss', duration: 90 },
        { time: '11:00', type: 'spot', name: 'DC-3 飛機殘骸', address: 'Solheimasandur', duration: 60 },
        { time: '12:30', type: 'restaurant', name: '午餐', address: 'Vik' },
        { time: '14:00', type: 'spot', name: 'Skogafoss', address: 'Skogafoss', duration: 120 },
        { time: '19:00', type: 'hotel', name: 'Hotel Vik', address: 'Vik', notes: 'NT$ 15,350' }
      ],
      notes: ['行車 122km', '1.5小時']
    }
  ];

  maxVisibleTabs: number = 5;

  ngOnInit(): void {
    // 初始化行程資料
    this.itineraries = {
      0: [...this.mockTravelData[0].itinerary],
      1: [...this.mockTravelData[1].itinerary],
      2: [...this.mockTravelData[2].itinerary]
    };

    // 初始化預算資料
    this.budgetItems = {
      0: [
        { id: '1', category: 'transport', name: '租車', amount: 2500, currency: 'TWD', notes: '4天租金', paidBy: '1', splitWith: ['1', '2', '3'], splitType: 'equal' },
        { id: '2', category: 'accommodation', name: 'Aurora Nooks', amount: 10637, currency: 'TWD', paidBy: '1', splitWith: ['1', '2', '3'], splitType: 'equal' },
        { id: '3', category: 'food', name: 'Harpa 餐廳晚餐', amount: 1200, currency: 'TWD', paidBy: '2', splitWith: ['1', '2'], splitType: 'equal' }
      ],
      1: [
        { id: '4', category: 'food', name: '午餐', amount: 800, currency: 'TWD', paidBy: '1', splitWith: ['1', '2', '3'], splitType: 'equal' },
        { id: '5', category: 'accommodation', name: 'Hotel South Coast', amount: 9247, currency: 'TWD', paidBy: '2', splitWith: ['1', '2', '3'], splitType: 'equal' },
        { id: '6', category: 'ticket', name: '國家公園門票', amount: 400, currency: 'TWD', paidBy: '3', splitWith: ['1', '2', '3'], splitType: 'equal' }
      ],
      2: [
        { id: '7', category: 'food', name: '午餐', amount: 900, currency: 'TWD', paidBy: '2', splitWith: ['1', '2', '3'], splitType: 'equal' },
        { id: '8', category: 'accommodation', name: 'Hotel Vik', amount: 15350, currency: 'TWD', paidBy: '3', splitWith: ['1', '2', '3'], splitType: 'equal' },
        { id: '9', category: 'transport', name: '加油', amount: 600, currency: 'TWD', paidBy: '1', splitWith: ['1', '2', '3'], splitType: 'equal' }
      ]
    };
  }

  // Getters
  get currentDay(): TravelDay {
    return this.mockTravelData[this.currentDayIndex];
  }

  get currentItinerary(): ItineraryItem[] {
    return this.itineraries[this.currentDayIndex] || this.currentDay.itinerary;
  }

  get currentBudget(): BudgetItem[] {
    return this.budgetItems[this.currentDayIndex] || [];
  }

  get visibleDays(): TravelDay[] {
    return this.mockTravelData.slice(this.tabStartIndex, this.tabStartIndex + this.maxVisibleTabs);
  }

  get canScrollLeft(): boolean {
    return this.tabStartIndex > 0;
  }

  get canScrollRight(): boolean {
    return this.tabStartIndex + this.maxVisibleTabs < this.mockTravelData.length;
  }

  get budgetPercentage(): number {
    return (this.getTotalSpent() / this.totalBudget) * 100;
  }

  // 導航方法
  goToPrevDay(): void {
    if (this.currentDayIndex > 0) {
      this.currentDayIndex--;
    }
  }

  goToNextDay(): void {
    if (this.currentDayIndex < this.mockTravelData.length - 1) {
      this.currentDayIndex++;
    }
  }

  scrollTabsLeft(): void {
    if (this.canScrollLeft) {
      this.tabStartIndex = Math.max(0, this.tabStartIndex - 1);
    }
  }

  scrollTabsRight(): void {
    if (this.canScrollRight) {
      this.tabStartIndex = Math.min(this.mockTravelData.length - this.maxVisibleTabs, this.tabStartIndex + 1);
    }
  }

  selectDay(index: number): void {
    this.currentDayIndex = index;
  }

  // 工具方法
  openMap(address: string): void {
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(address)}`, '_blank');
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[date.getDay()];
    return `${month}/${day} 週${weekday}`;
  }

  getTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      spot: 'mapPin',
      restaurant: 'restaurant',
      hotel: 'hotel',
      activity: 'activity'
    };
    return icons[type] || 'clock';
  }

  getTypeColor(type: string): string {
    if (this.isDarkMode) {
      const colors: { [key: string]: string } = {
        spot: 'bg-cyan-500',
        restaurant: 'bg-emerald-500',
        hotel: 'bg-purple-500',
        activity: 'bg-blue-500'
      };
      return colors[type] || 'bg-gray-500';
    } else {
      const colors: { [key: string]: string } = {
        spot: 'bg-blue-500',
        restaurant: 'bg-orange-500',
        hotel: 'bg-purple-500',
        activity: 'bg-green-500'
      };
      return colors[type] || 'bg-gray-500';
    }
  }

  // 圖片處理
  handleImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        this.uploadedImages[this.currentDayIndex] = reader.result as string;
        this.showImageUpload = false;
      };
      reader.readAsDataURL(file);
    }
  }

  getCurrentImage(): string {
    return this.uploadedImages[this.currentDayIndex] || this.currentDay.heroImage;
  }

  removeUploadedImage(): void {
    delete this.uploadedImages[this.currentDayIndex];
  }

  // 拖曳處理
  handleDragStart(index: number): void {
    this.draggedItemIndex = index;
  }

  handleDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  handleDrop(event: DragEvent, dropIndex: number): void {
    event.preventDefault();
    if (this.draggedItemIndex === null || this.draggedItemIndex === dropIndex) return;

    const newItinerary = [...this.currentItinerary];
    const draggedItem = newItinerary[this.draggedItemIndex];
    
    newItinerary.splice(this.draggedItemIndex, 1);
    newItinerary.splice(dropIndex, 0, draggedItem);
    
    this.itineraries[this.currentDayIndex] = newItinerary;
    this.draggedItemIndex = null;
  }

  handleDragEnd(): void {
    this.draggedItemIndex = null;
  }

  // 行程管理
  openAddItinerary(): void {
    this.itineraryForm = {
      time: '',
      type: 'spot',
      name: '',
      address: '',
      duration: 0,
      notes: ''
    };
    this.editingIndex = null;
    this.showItineraryForm = true;
  }

  openEditItinerary(index: number): void {
    this.itineraryForm = { ...this.currentItinerary[index] };
    this.editingIndex = index;
    this.showItineraryForm = true;
  }

  closeItineraryForm(): void {
    this.showItineraryForm = false;
    this.editingIndex = null;
  }

  saveItinerary(): void {
    if (!this.itineraryForm.time || !this.itineraryForm.name || !this.itineraryForm.address) {
      alert('請填寫時間、名稱和地址');
      return;
    }

    const newItinerary = [...this.currentItinerary];
    
    if (this.editingIndex !== null) {
      newItinerary[this.editingIndex] = { ...this.itineraryForm };
    } else {
      newItinerary.push({ ...this.itineraryForm });
      newItinerary.sort((a, b) => a.time.localeCompare(b.time));
    }
    
    this.itineraries[this.currentDayIndex] = newItinerary;
    this.closeItineraryForm();
  }

  deleteItinerary(index: number): void {
    if (confirm('確定要刪除這個行程嗎?')) {
      const newItinerary = this.currentItinerary.filter((_, i) => i !== index);
      this.itineraries[this.currentDayIndex] = newItinerary;
    }
  }

  // 預算管理
  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      transport: 'car',
      food: 'restaurant',
      accommodation: 'hotel',
      ticket: 'ticket'
    };
    return icons[category] || 'dollar';
  }

  getCategoryColor(category: string): string {
    if (this.isDarkMode) {
      const colors: { [key: string]: string } = {
        transport: 'bg-blue-500',
        food: 'bg-emerald-500',
        accommodation: 'bg-purple-500',
        ticket: 'bg-orange-500'
      };
      return colors[category] || 'bg-gray-500';
    } else {
      const colors: { [key: string]: string } = {
        transport: 'bg-blue-500',
        food: 'bg-orange-500',
        accommodation: 'bg-purple-500',
        ticket: 'bg-pink-500'
      };
      return colors[category] || 'bg-gray-500';
    }
  }

  getCategoryName(category: string): string {
    const names: { [key: string]: string } = {
      transport: '交通',
      food: '餐飲',
      accommodation: '住宿',
      ticket: '門票',
      other: '其他'
    };
    return names[category] || '其他';
  }

  convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
    const fromRate = this.exchangeRates[fromCurrency] || 1;
    const toRate = this.exchangeRates[toCurrency] || 1;
    return (amount / fromRate) * toRate;
  }

  formatCurrency(amount: number, currency: string): string {
    const symbols: { [key: string]: string } = {
      TWD: 'NT$',
      USD: '$',
      EUR: '€',
      JPY: '¥',
      ISK: 'kr',
      CNY: '¥'
    };
    return `${symbols[currency] || currency} ${amount.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  getTotalSpent(): number {
    let total = 0;
    Object.values(this.budgetItems).forEach(dayBudgets => {
      dayBudgets.forEach(item => {
        total += this.convertCurrency(item.amount, item.currency, this.baseCurrency);
      });
    });
    return total;
  }

  getDayTotal(dayIndex: number): number {
    const dayBudgets = this.budgetItems[dayIndex] || [];
    return dayBudgets.reduce((sum, item) => {
      return sum + this.convertCurrency(item.amount, item.currency, this.baseCurrency);
    }, 0);
  }

  getCategoryTotal(category: string): number {
    let total = 0;
    Object.values(this.budgetItems).forEach(dayBudgets => {
      dayBudgets.forEach(item => {
        if (item.category === category) {
          total += this.convertCurrency(item.amount, item.currency, this.baseCurrency);
        }
      });
    });
    return total;
  }

  getCategoryPercentage(category: string): number {
    const total = this.getCategoryTotal(category);
    return this.totalBudget > 0 ? (total / this.totalBudget) * 100 : 0;
  }

  openAddBudget(): void {
    this.budgetForm = {
      id: Date.now().toString(),
      category: 'food',
      name: '',
      amount: 0,
      currency: this.baseCurrency,
      notes: '',
      paidBy: this.members[0]?.id || '',
      splitWith: this.members.map(m => m.id),
      splitType: 'equal',
      customSplits: {}
    };
    this.editingBudgetId = null;
    this.showBudgetForm = true;
  }

  openEditBudget(item: BudgetItem): void {
    this.budgetForm = { ...item };
    this.editingBudgetId = item.id;
    this.showBudgetForm = true;
  }

  closeBudgetForm(): void {
    this.showBudgetForm = false;
    this.editingBudgetId = null;
  }

  saveBudget(): void {
    if (!this.budgetForm.name || this.budgetForm.amount <= 0) {
      alert('請填寫名稱和金額');
      return;
    }

    const currentDayBudgets = [...this.currentBudget];
    
    if (this.editingBudgetId) {
      const index = currentDayBudgets.findIndex(item => item.id === this.editingBudgetId);
      if (index !== -1) {
        currentDayBudgets[index] = { ...this.budgetForm };
      }
    } else {
      currentDayBudgets.push({ ...this.budgetForm });
    }
    
    this.budgetItems[this.currentDayIndex] = currentDayBudgets;
    this.closeBudgetForm();
  }

  deleteBudget(id: string): void {
    if (confirm('確定要刪除這筆支出嗎?')) {
      const newBudgets = this.currentBudget.filter(item => item.id !== id);
      this.budgetItems[this.currentDayIndex] = newBudgets;
    }
  }

  getProgressBarColor(): string {
    if (this.budgetPercentage > 100) {
      return 'bg-gradient-to-r from-red-500 to-red-600';
    } else if (this.budgetPercentage > 80) {
      return 'bg-gradient-to-r from-orange-500 to-yellow-500';
    } else if (this.isDarkMode) {
      return 'bg-gradient-to-r from-cyan-500 to-blue-500';
    } else {
      return 'bg-gradient-to-r from-purple-500 to-pink-500';
    }
  }

  getProgressBarTextColor(): string {
    if (this.budgetPercentage > 100) {
      return 'text-red-500';
    } else if (this.budgetPercentage > 80) {
      return 'text-orange-500';
    } else if (this.isDarkMode) {
      return 'text-cyan-400';
    } else {
      return 'text-purple-600';
    }
  }

  getExchangeRate(currency: string): string {
    if (currency === 'TWD') return '1';
    const rate = this.exchangeRates[currency];
    if (!rate) return '0';
    
    if (currency === 'JPY' || currency === 'ISK') {
      return (100 / rate).toFixed(2);
    }
    return (1 / rate).toFixed(2);
  }

  // 成員管理方法
  openAddMember(): void {
    this.memberForm = {
      id: Date.now().toString(),
      name: '',
      color: this.availableColors[0]
    };
    this.editingMemberId = null;
    this.showMemberForm = true;
  }

  openEditMember(member: Member): void {
    this.memberForm = { ...member };
    this.editingMemberId = member.id;
    this.showMemberForm = true;
  }

  closeMemberForm(): void {
    this.showMemberForm = false;
    this.editingMemberId = null;
  }

  saveMember(): void {
    if (!this.memberForm.name.trim()) {
      alert('請填寫成員名稱');
      return;
    }

    if (this.editingMemberId) {
      const index = this.members.findIndex(m => m.id === this.editingMemberId);
      if (index !== -1) {
        this.members[index] = { ...this.memberForm };
      }
    } else {
      this.members.push({ ...this.memberForm });
    }
    this.closeMemberForm();
  }

  deleteMember(id: string): void {
    if (this.members.length <= 1) {
      alert('至少需要保留一位成員');
      return;
    }
    if (confirm('確定要刪除這位成員嗎？')) {
      this.members = this.members.filter(m => m.id !== id);
      // 清理相關的分賬記錄
      Object.keys(this.budgetItems).forEach(dayIndex => {
        this.budgetItems[Number(dayIndex)] = this.budgetItems[Number(dayIndex)].map(item => ({
          ...item,
          paidBy: item.paidBy === id ? undefined : item.paidBy,
          splitWith: item.splitWith?.filter(memberId => memberId !== id)
        }));
      });
    }
  }

  getMemberById(id: string | undefined): Member | undefined {
    if (!id) return undefined;
    return this.members.find(m => m.id === id);
  }

  getMemberName(id: string | undefined): string {
    const member = this.getMemberById(id);
    return member?.name || '未知';
  }

  toggleSplitMember(memberId: string): void {
    if (!this.budgetForm.splitWith) {
      this.budgetForm.splitWith = [];
    }
    const index = this.budgetForm.splitWith.indexOf(memberId);
    if (index > -1) {
      this.budgetForm.splitWith.splice(index, 1);
    } else {
      this.budgetForm.splitWith.push(memberId);
    }
  }

  isMemberInSplit(memberId: string): boolean {
    return this.budgetForm.splitWith?.includes(memberId) || false;
  }

  // 分賬計算方法
  calculateMemberPaid(memberId: string): number {
    let total = 0;
    Object.values(this.budgetItems).forEach(dayBudgets => {
      dayBudgets.forEach(item => {
        if (item.paidBy === memberId) {
          total += this.convertCurrency(item.amount, item.currency, this.baseCurrency);
        }
      });
    });
    return total;
  }

  calculateMemberShould(memberId: string): number {
    let total = 0;
    Object.values(this.budgetItems).forEach(dayBudgets => {
      dayBudgets.forEach(item => {
        if (item.splitWith?.includes(memberId)) {
          const amount = this.convertCurrency(item.amount, item.currency, this.baseCurrency);
          if (item.splitType === 'custom' && item.customSplits) {
            total += item.customSplits[memberId] || 0;
          } else {
            // 平均分攤
            const splitCount = item.splitWith.length;
            total += amount / splitCount;
          }
        }
      });
    });
    return total;
  }

  calculateMemberBalance(memberId: string): number {
    return this.calculateMemberPaid(memberId) - this.calculateMemberShould(memberId);
  }

  getSettlements(): Settlement[] {
    // 計算每個人的餘額
    const balances = this.members.map(member => ({
      id: member.id,
      name: member.name,
      balance: this.calculateMemberBalance(member.id)
    }));

    // 分離債權人和債務人
    const creditors = balances.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
    const debtors = balances.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance);

    const settlements: Settlement[] = [];
    let i = 0, j = 0;

    while (i < creditors.length && j < debtors.length) {
      const creditor = creditors[i];
      const debtor = debtors[j];
      const amount = Math.min(creditor.balance, -debtor.balance);

      if (amount > 0.01) {
        settlements.push({
          from: debtor.id,
          to: creditor.id,
          amount: Math.round(amount)
        });
      }

      creditor.balance -= amount;
      debtor.balance += amount;

      if (Math.abs(creditor.balance) < 0.01) i++;
      if (Math.abs(debtor.balance) < 0.01) j++;
    }

    return settlements;
  }

  getMemberColor(id: string | undefined): string {
    const member = this.getMemberById(id);
    return member?.color || 'bg-gray-500';
  }
}
