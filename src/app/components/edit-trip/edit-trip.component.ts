import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TripService } from '../../services/trip.service';

@Component({
  selector: 'app-edit-trip',
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-trip.component.html',
  styleUrl: './edit-trip.component.css'
})
export class EditTripComponent implements OnInit {
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

  private tripId = '';
  private originalDestination = '';
  saving = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tripService: TripService
  ) {}

  ngOnInit(): void {
    this.tripId = this.route.snapshot.paramMap.get('id') ?? '';
    const existing = this.tripService.getTripById(this.tripId);
    if (!existing) {
      this.router.navigate(['/']);
      return;
    }
    this.originalDestination = existing.destination;
    this.trip = {
      title: existing.title,
      destination: existing.destination,
      startDate: this.toDateInput(existing.startDate),
      endDate: this.toDateInput(existing.endDate),
      description: existing.description ?? '',
      budget: existing.budget,
      currency: 'TWD',
      imageUrl: existing.imageUrl ?? ''
    };
  }

  private toDateInput(date: Date): string {
    const d = new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

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

    this.saving = true;
    await this.tripService.updateTrip(this.tripId, {
      title: this.trip.title,
      destination: this.trip.destination,
      startDate: start,
      endDate: end,
      description: this.trip.description || undefined,
      budget: this.trip.budget,
      imageUrl: this.trip.imageUrl || undefined
    }, this.trip.destination !== this.originalDestination);

    this.saving = false;
    this.router.navigate(['/']);
  }

  cancel(): void {
    this.router.navigate(['/']);
  }
}
