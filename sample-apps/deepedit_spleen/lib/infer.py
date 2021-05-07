from monai.apps.deepgrow.transforms import (
    AddGuidanceFromPointsd,
    SpatialCropGuidanced,
    ResizeGuidanced,
    AddGuidanceSignald,
    RestoreLabeld
)
from monai.inferers import SimpleInferer
from monai.transforms import (
    LoadImaged,
    AsChannelFirstd,
    AddChanneld,
    Activationsd,
    AsDiscreted,
    CropForegroundd,
    ToNumpyd,
    Resized,
    Spacingd,
    Orientationd,
    NormalizeIntensityd,
    AsChannelLastd,
    ToTensord,
    SqueezeDimd,
    ScaleIntensityRanged,
)
from monailabel.utils.infer import InferenceTask, InferType
from monailabel.utils.others.post import BoundingBoxd, Restored
from .transforms import AddEmptyGuidanced, ResizeGuidanceCustomd

from monai.transforms.transform import Transform, MapTransform


class Segmentation(InferenceTask):
    """
    This provides Inference Engine for pre-trained heart segmentation (UNet) model over MSD Dataset.
    """

    def __init__(
            self,
            path,
            network=None,
            type=InferType.SEGMENTATION,
            labels=["spleen"],
            dimension=3,
            description='A pre-trained model for volumetric (3D) segmentation of the spleen over 3D CT Images'
    ):
        super().__init__(
            path=path,
            network=network,
            type=type,
            labels=labels,
            dimension=dimension,
            description=description,
            input_key="image",
            output_label_key="pred",
            output_json_key="result"
        )

    def pre_transforms(self):
        return [
                LoadImaged(keys=('image')),
                AddChanneld(keys=('image')),
                Spacingd(keys=["image"], pixdim=(1.0, 1.0, 1.0), mode=("bilinear")),
                Orientationd(keys=["image"], axcodes="RAS"),
                NormalizeIntensityd(keys='image'),
                CropForegroundd(keys='image', source_key='image', select_fn=lambda x: x > 1.3, margin=3), # select_fn and margin are Task dependant
                Resized(keys=('image'), spatial_size=(128,128,128), mode=('area')),
                AddEmptyGuidanced(image='image'),
                ToTensord(keys=('image'))
               ]

    def inferer(self):
        return SimpleInferer()

    def inverse_transforms(self):
        return []  # Self-determine from the list of pre-transforms provided

    def post_transforms(self):
        return [
            ToTensord(keys='pred'),
            Activationsd(keys='pred', sigmoid=True),
            AsDiscreted(keys='pred', threshold_values=True, logit_thresh=0.51),
            SqueezeDimd(keys='pred', dim=0),
            ToNumpyd(keys='pred'),
        ]


class Deepgrow(InferenceTask):
    """
    This provides Inference Engine for Deepgrow over DeepEdit model.
    """

    def __init__(
            self,
            path,
            network=None,
            type=InferType.DEEPGROW,
            labels=[],
            dimension=3,
            description='A pre-trained 3D DeepGrow model based on UNET',
            spatial_size=[128, 128],
            model_size=[128, 128, 128]
    ):
        super().__init__(
            path=path,
            network=network,
            type=type,
            labels=labels,
            dimension=dimension,
            description=description
        )

        self.spatial_size = spatial_size
        self.model_size = model_size

    def pre_transforms(self):
        return [
            LoadImaged(keys='image'),
            # Spacingd(keys='image', pixdim=[1.0, 1.0, 1.0], mode='bilinear'), # The inverse of this transform causes some issues
            Orientationd(keys="image", axcodes="RAS"),
            AddGuidanceFromPointsd(ref_image='image', guidance='guidance', dimensions=3),
            AddChanneld(keys='image'),
            NormalizeIntensityd(keys='image'),
            # CropForegroundd(keys=('image'), source_key='image', select_fn=lambda x: x > 1.3, margin=3), # For Spleen -- NOT NEEDED - ITS DOESN'T CONTRIBUTE
            Resized(keys='image', spatial_size=self.model_size, mode='area'),
            ResizeGuidanceCustomd(guidance='guidance', ref_image='image'),
            AddGuidanceSignald(image='image', guidance='guidance'),
        ]

    def inferer(self):
        return SimpleInferer()

    def post_transforms(self):
        return [
            ToTensord(keys='pred'),
            Activationsd(keys='pred', sigmoid=True),
            AsDiscreted(keys='pred', threshold_values=True, logit_thresh=0.51),
            SqueezeDimd(keys='pred', dim=0),
            ToNumpyd(keys='pred'),
        ]