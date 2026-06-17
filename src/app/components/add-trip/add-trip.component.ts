import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TripService } from '../../services/trip.service';

@Component({
  selector: 'app-add-trip',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-trip.component.html',
  styleUrl: './add-trip.component.css'
})
export class AddTripComponent {
  trip = {
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    description: '',
    budget: undefined as number | undefined,
    currency: 'TWD',
    imageUrl: ''
  };

  constructor(
    private tripService: TripService,
    private router: Router
  ) {}

  async onSubmit(): Promise<void> {
    if (!this.trip.title || !this.trip.destination || !this.trip.startDate || !this.trip.endDate) {
      alert('請填寫所有必填欄位');
      return;
    }
    const start = new Date(this.trip.startDate);
    const end = new Date(this.trip.endDate);
    if (end < start) {
      alert('返回日期不能早於出發日期');
      return;
    }
    const result = await this.tripService.addTrip({
      title: this.trip.title,
      destination: this.trip.destination,
      startDate: start,
      endDate: end,
      description: this.trip.description || undefined,
      budget: this.trip.budget,
      imageUrl: this.trip.imageUrl || undefined,
      activities: [],
      expenses: []
    });
    if (!result) {
      alert('儲存失敗，請開啟 F12 → Console 查看錯誤訊息');
      return;
    }
    this.router.navigate(['/']);
  }

  cancel(): void {
    this.router.navigate(['/']);
  }
}
