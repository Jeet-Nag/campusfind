import { useState } from 'preact/hooks';
import {
  CampusItemType,
  CampusCategory,
  CAMPUS_CATEGORIES,
  CAMPUS_LOCATIONS,
} from '@shared';
import {
  submitItemReport,
  uploadItemPhoto,
  navigateTo,
  showNotification,
} from '../state/campus';
import { isAuthenticated, currentUser } from '../state/auth';

interface ReportFormScreenProps {
  initialType?: CampusItemType;
}

export function ReportFormScreen({ initialType = 'lost' }: ReportFormScreenProps) {
  const [itemType, setItemType] = useState<CampusItemType>(initialType);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CampusCategory>('electronics');
  const [location, setLocation] = useState(CAMPUS_LOCATIONS[0]);
  const [specificLocation, setSpecificLocation] = useState('');
  const [dateOccurred, setDateOccurred] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [contactMethod, setContactMethod] = useState(
    currentUser.value?.email ? `Campus Email (${currentUser.value.email})` : 'Portal Claim / Secure Message'
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSensitive, setIsSensitive] = useState(false);
  const [sensitiveDetails, setSensitiveDetails] = useState('');

  // Form errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedItem, setSubmittedItem] = useState<any | null>(null);

  // If user is not authenticated, prompt sign-in banner
  if (!isAuthenticated.value) {
    return (
      <div class="max-w-md mx-auto my-12 bg-surface border border-border rounded-2xl p-6 sm:p-8 text-center shadow-xs space-y-4">
        <div class="w-14 h-14 rounded-full bg-brand/10 text-brand flex items-center justify-center text-3xl mx-auto">
          🔐
        </div>
        <h2 class="text-xl font-bold text-text-main">Student Sign In Required</h2>
        <p class="text-xs sm:text-sm text-text-sub">
          To ensure campus trust and prevent spam, students must sign in before reporting a lost or found item.
        </p>
        <button
          onClick={() => navigateTo('auth')}
          class="w-full py-3 bg-brand text-white font-bold text-sm rounded-xl hover:bg-brand-dark transition-colors shadow-xs"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  // Handle image upload
  const handleFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, image: 'Image size must be less than 10MB.' }));
      return;
    }

    setUploadingImage(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });

    const res = await uploadItemPhoto(file);
    setUploadingImage(false);

    if (res.success && res.url) {
      setImageUrl(res.url);
      showNotification('Photo uploaded successfully.', 'success');
    } else {
      setErrors((prev) => ({ ...prev, image: res.error || 'Failed to upload photo.' }));
    }
  };

  // Validate inputs
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim() || title.trim().length < 2) {
      newErrors.title = 'Item name must be at least 2 characters.';
    }

    if (!description.trim() || description.trim().length < 5) {
      newErrors.description = 'Please provide a descriptive summary of at least 5 characters.';
    }

    if (!location.trim()) {
      newErrors.location = 'Please select a campus location.';
    }

    if (!dateOccurred) {
      newErrors.dateOccurred = 'Please specify the date.';
    }

    if (!contactMethod.trim() || contactMethod.trim().length < 2) {
      newErrors.contactMethod = 'Please provide preferred contact method.';
    }

    if (isSensitive && (!sensitiveDetails.trim() || sensitiveDetails.trim().length < 3)) {
      newErrors.sensitiveDetails =
        'Please provide private distinguishing details (e.g. last 4 digits, sticker name) so rightful owners can verify.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    const fullLocation = specificLocation.trim()
      ? `${location} (${specificLocation.trim()})`
      : location;

    const res = await submitItemReport({
      type: itemType,
      title: title.trim(),
      category,
      location: fullLocation,
      dateOccurred,
      description: description.trim(),
      contactMethod: contactMethod.trim(),
      imageUrl: imageUrl || null,
      isSensitive,
      sensitiveDetails: isSensitive ? sensitiveDetails.trim() : null,
    });

    setSubmitting(false);

    if (res.success && res.item) {
      setSubmittedItem(res.item);
      showNotification(
        itemType === 'lost'
          ? 'Lost item report successfully published!'
          : 'Found item report successfully posted!',
        'success'
      );
    } else {
      setErrors((prev) => ({
        ...prev,
        form: res.error || 'Failed to submit report. Please check required fields.',
      }));
    }
  };

  // If successfully submitted, display confirmation view
  if (submittedItem) {
    return (
      <div class="max-w-lg mx-auto my-8 bg-surface border border-border rounded-2xl p-6 sm:p-8 text-center shadow-xs space-y-4">
        <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl mx-auto">
          ✓
        </div>
        <h2 class="text-2xl font-extrabold text-text-main">Report Successfully Saved!</h2>
        <p class="text-xs sm:text-sm text-text-sub">
          Your {submittedItem.type} item report for "<strong>{submittedItem.title}</strong>" is now live on CampusFind.
        </p>

        {submittedItem.isSensitive && (
          <div class="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs text-left">
            <strong>🔒 Privacy Active:</strong> Your confidential notes ({submittedItem.sensitiveDetails ? 'private digits/marks' : 'details'}) are protected and concealed from the public listing.
          </div>
        )}

        <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigateTo('item-detail', submittedItem.id)}
            class="w-full sm:w-auto px-5 py-2.5 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark transition-colors"
          >
            View Item Report
          </button>
          <button
            onClick={() => navigateTo('my-reports')}
            class="w-full sm:w-auto px-5 py-2.5 border border-border text-text-main text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors"
          >
            Go to My Reports
          </button>
          <button
            onClick={() => {
              setSubmittedItem(null);
              setTitle('');
              setDescription('');
              setImageUrl(null);
              setIsSensitive(false);
              setSensitiveDetails('');
            }}
            class="w-full sm:w-auto px-5 py-2.5 text-xs text-text-sub hover:text-text-main font-semibold"
          >
            Submit Another Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="max-w-2xl mx-auto pb-12 space-y-6">
      {/* Title & Type Toggle */}
      <div class="text-center sm:text-left">
        <h1 class="text-2xl font-extrabold text-brand tracking-tight">
          {itemType === 'lost' ? 'Report a Lost Item' : 'Report a Found Item'}
        </h1>
        <p class="text-xs sm:text-sm text-text-sub mt-1">
          {itemType === 'lost'
            ? 'Provide details so students or campus staff can help recover your missing item.'
            : 'Help return found property safely. Sensitive documents and ID cards are protected.'}
        </p>
      </div>

      {/* Switcher Tabs */}
      <div class="flex items-center p-1 bg-slate-100 rounded-xl">
        <button
          type="button"
          onClick={() => setItemType('lost')}
          class={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            itemType === 'lost'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-text-sub hover:text-amber-800'
          }`}
        >
          <span>📢</span> I Lost Something
        </button>
        <button
          type="button"
          onClick={() => setItemType('found')}
          class={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            itemType === 'found'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-text-sub hover:text-emerald-800'
          }`}
        >
          <span>🎁</span> I Found Something
        </button>
      </div>

      {/* Main Form Card */}
      <form onSubmit={handleSubmit} class="bg-surface border border-border rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
        {errors.form && (
          <div class="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
            {errors.form}
          </div>
        )}

        {/* Item Title */}
        <div>
          <label class="block text-xs font-bold text-text-main mb-1">
            Item Name <span class="text-danger">*</span>
          </label>
          <input
            type="text"
            value={title}
            onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
            placeholder={itemType === 'lost' ? 'e.g., TI-84 Plus CE Calculator, Blue Hydro Flask' : 'e.g., Brown Leather Fossil Wallet, Student ID Card'}
            class={`w-full px-3.5 py-2.5 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand text-text-main ${
              errors.title ? 'border-danger ring-1 ring-danger' : 'border-border'
            }`}
          />
          {errors.title && <p class="text-[11px] text-danger mt-1 font-medium">{errors.title}</p>}
        </div>

        {/* Category & Date Grid */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-text-main mb-1">
              Category <span class="text-danger">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => {
                const cat = (e.target as HTMLSelectElement).value as CampusCategory;
                setCategory(cat);
                if (cat === 'student_ids_cards' || cat === 'keys_wallets') {
                  setIsSensitive(true);
                }
              }}
              class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand text-text-main cursor-pointer"
            >
              {CAMPUS_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-text-main mb-1">
              {itemType === 'lost' ? 'Date Lost' : 'Date Found'} <span class="text-danger">*</span>
            </label>
            <input
              type="date"
              value={dateOccurred}
              onInput={(e) => setDateOccurred((e.target as HTMLInputElement).value)}
              class={`w-full px-3.5 py-2.5 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand text-text-main ${
                errors.dateOccurred ? 'border-danger' : 'border-border'
              }`}
            />
            {errors.dateOccurred && (
              <p class="text-[11px] text-danger mt-1 font-medium">{errors.dateOccurred}</p>
            )}
          </div>
        </div>

        {/* Campus Location */}
        <div class="space-y-2">
          <label class="block text-xs font-bold text-text-main">
            {itemType === 'lost' ? 'Last-Seen Location' : 'Found Location'} <span class="text-danger">*</span>
          </label>
          <select
            value={location}
            onChange={(e) => setLocation((e.target as HTMLSelectElement).value)}
            class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand text-text-main cursor-pointer"
          >
            {CAMPUS_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                📍 {loc}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={specificLocation}
            onInput={(e) => setSpecificLocation((e.target as HTMLInputElement).value)}
            placeholder="Room number, desk, or specific landmark (e.g. 2nd floor pod 4, bench by oak tree)"
            class="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
          />
        </div>

        {/* Description */}
        <div>
          <label class="block text-xs font-bold text-text-main mb-1">
            Description <span class="text-danger">*</span>
          </label>
          <textarea
            rows={3}
            value={description}
            onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
            placeholder="Describe the item (color, brand, distinguishing features, stickers, wear and tear)..."
            class={`w-full px-3.5 py-2.5 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand text-text-main ${
              errors.description ? 'border-danger ring-1 ring-danger' : 'border-border'
            }`}
          />
          {errors.description && (
            <p class="text-[11px] text-danger mt-1 font-medium">{errors.description}</p>
          )}
        </div>

        {/* Contact Method */}
        <div>
          <label class="block text-xs font-bold text-text-main mb-1">
            Safe Contact Method or Hand-off Desk <span class="text-danger">*</span>
          </label>
          <input
            type="text"
            value={contactMethod}
            onInput={(e) => setContactMethod((e.target as HTMLInputElement).value)}
            placeholder="e.g., Campus Email / Portal Claim, Library Circulation Desk, Rec Center Front Desk"
            class={`w-full px-3.5 py-2.5 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand text-text-main ${
              errors.contactMethod ? 'border-danger' : 'border-border'
            }`}
          />
          {errors.contactMethod && (
            <p class="text-[11px] text-danger mt-1 font-medium">{errors.contactMethod}</p>
          )}
          <p class="text-[11px] text-text-sub mt-1">
            Note: For student safety, your private direct contact information is not revealed automatically on public pages.
          </p>
        </div>

        {/* Photo Upload */}
        <div>
          <label class="block text-xs font-bold text-text-main mb-1">
            Item Photo (Optional)
          </label>
          <div class="flex items-center gap-3">
            <label class="cursor-pointer px-4 py-2 border border-border hover:border-brand rounded-xl text-xs font-bold text-text-main bg-background hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-2xs">
              <span>📷</span> {uploadingImage ? 'Uploading...' : 'Choose Photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                disabled={uploadingImage}
                class="hidden"
              />
            </label>

            {imageUrl && (
              <div class="flex items-center gap-2">
                <img
                  src={imageUrl}
                  alt="Uploaded preview"
                  class="w-10 h-10 object-cover rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  class="text-xs text-danger font-semibold hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          {errors.image && <p class="text-[11px] text-danger mt-1 font-medium">{errors.image}</p>}
        </div>

        {/* Privacy & Sensitive Info Protection Section */}
        <div class="p-4 bg-slate-50 border border-border rounded-xl space-y-3">
          <label class="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isSensitive}
              onChange={(e) => setIsSensitive((e.target as HTMLInputElement).checked)}
              class="mt-0.5 rounded border-border text-brand focus:ring-brand w-4 h-4 cursor-pointer"
            />
            <div>
              <span class="text-xs font-bold text-text-main">
                Shield confidential details (IDs, financial cards, valuables)
              </span>
              <p class="text-[11px] text-text-sub">
                Check this if this item has sensitive identifiers (student ID number, bank card digits, cash amounts) that should never be shown publicly.
              </p>
            </div>
          </label>

          {isSensitive && (
            <div class="pt-2 border-t border-border/70 space-y-1">
              <label class="block text-xs font-bold text-brand">
                Confidential Distinguishing Details (Private to You) <span class="text-danger">*</span>
              </label>
              <textarea
                rows={2}
                value={sensitiveDetails}
                onInput={(e) => setSensitiveDetails((e.target as HTMLTextAreaElement).value)}
                placeholder="e.g. Student ID ends in 4102, blue cartoon sticker on back of card, $20 folded bill inside..."
                class={`w-full px-3 py-2 bg-white border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main ${
                  errors.sensitiveDetails ? 'border-danger' : 'border-border'
                }`}
              />
              {errors.sensitiveDetails && (
                <p class="text-[11px] text-danger font-medium">{errors.sensitiveDetails}</p>
              )}
              <p class="text-[10px] text-text-sub">
                🛡️ This information is stored privately and will NEVER appear in public search or item cards. You will use this to verify claimant answers.
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || uploadingImage}
          class={`w-full py-3.5 text-white font-bold text-sm rounded-xl transition-all shadow-sm ${
            itemType === 'lost'
              ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'
              : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
          } ${submitting || uploadingImage ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {submitting
            ? 'Publishing Report...'
            : itemType === 'lost'
            ? '📢 Publish Lost Item Report'
            : '🎁 Publish Found Item Report'}
        </button>
      </form>
    </div>
  );
}
